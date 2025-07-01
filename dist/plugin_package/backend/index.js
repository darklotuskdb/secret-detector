// packages/backend/src/index.ts
function buildFlexibleRegex(keyword) {
  const escaped = keyword.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  const flexible = escaped.replace(/_/g, "[_-\\s]");
  return new RegExp(
    `${flexible}\\s*[:=]\\s*['"][^'"]+['"]`,
    "gi"
  );
}
var predefinedKeywords = {
  high: [],
  medium: [],
  low: []
};
var severityToggles = {
  high: true,
  medium: true,
  low: true,
  critical: true
};
var allFindings = [];
var toolEnabled = true;
var excludedExtensions = [];
async function loadExcludedExtensions(sdk) {
  const db = await sdk.meta.db();
  await db.exec("CREATE TABLE IF NOT EXISTS excluded_extensions (ext TEXT PRIMARY KEY)");
  const stmt = await db.prepare("SELECT ext FROM excluded_extensions");
  const rows = await stmt.all();
  excludedExtensions = rows.map((r) => r.ext);
}
async function saveExcludedExtensions(sdk) {
  const db = await sdk.meta.db();
  await db.exec("CREATE TABLE IF NOT EXISTS excluded_extensions (ext TEXT PRIMARY KEY)");
  await db.exec("DELETE FROM excluded_extensions");
  for (const ext of excludedExtensions) {
    if (ext && typeof ext === "string") {
      const stmt = await db.prepare("INSERT OR IGNORE INTO excluded_extensions (ext) VALUES (?)");
      await stmt.run(ext);
    }
  }
}
function init(sdk) {
  loadExcludedExtensions(sdk);
  sdk.api.register("getCriticalKeywords", async () => {
    const db = await sdk.meta.db();
    await db.exec("CREATE TABLE IF NOT EXISTS critical_keywords (keyword TEXT PRIMARY KEY)");
    const stmt = await db.prepare("SELECT keyword FROM critical_keywords");
    const rows = await stmt.all();
    return rows.map((r) => r.keyword);
  });
  sdk.api.register("setCriticalKeywords", async (_sdk, keywords) => {
    const db = await sdk.meta.db();
    await db.exec("CREATE TABLE IF NOT EXISTS critical_keywords (keyword TEXT PRIMARY KEY)");
    await db.exec("DELETE FROM critical_keywords");
    for (const kw of keywords) {
      if (kw && typeof kw === "string") {
        const stmt = await db.prepare("INSERT OR IGNORE INTO critical_keywords (keyword) VALUES (?)");
        await stmt.run(kw);
      }
    }
    return true;
  });
  sdk.api.register("setPredefinedKeywords", async (_sdk, payload) => {
    predefinedKeywords.high = Array.isArray(payload.high) ? payload.high : [];
    predefinedKeywords.medium = Array.isArray(payload.medium) ? payload.medium : [];
    predefinedKeywords.low = Array.isArray(payload.low) ? payload.low : [];
    sdk.console.log(`[Secret Detector] Predefined keywords updated: high=${predefinedKeywords.high.length}, medium=${predefinedKeywords.medium.length}, low=${predefinedKeywords.low.length}`);
    return true;
  });
  sdk.api.register("setSeverityToggles", async (_sdk, toggles) => {
    severityToggles = { ...severityToggles, ...toggles };
    sdk.console.log(`[Secret Detector] Severity toggles updated: ${JSON.stringify(severityToggles)}`);
    return true;
  });
  sdk.api.register("getSeverityToggles", async () => {
    return severityToggles;
  });
  sdk.api.register("getAllFindings", async () => {
    return allFindings;
  });
  sdk.api.register("getKeywordStats", async () => {
    const severityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
    const keywordSeverityMap = {};
    for (const finding of allFindings) {
      if (finding.severity && typeof finding.severity === "string" && severityCounts.hasOwnProperty(finding.severity)) {
        severityCounts[finding.severity]++;
      }
      if (Array.isArray(finding.items) && finding.severity) {
        for (const kw of finding.items) {
          if (typeof kw === "string") {
            if (!keywordSeverityMap[kw]) keywordSeverityMap[kw] = { high: 0, medium: 0, low: 0, critical: 0 };
            keywordSeverityMap[kw][finding.severity] = (keywordSeverityMap[kw][finding.severity] || 0) + 1;
          }
        }
      }
    }
    const keywords = [];
    for (const [kw, sevMap] of Object.entries(keywordSeverityMap)) {
      for (const sev of ["critical", "high", "medium", "low"]) {
        const count = sevMap[sev] ?? 0;
        if (count > 0) {
          keywords.push({ keyword: kw, count, severity: sev });
        }
      }
    }
    keywords.sort((a, b) => b.count - a.count);
    return { stats: severityCounts, keywords };
  });
  sdk.api.register("setToolEnabled", async (_sdk, enabled) => {
    toolEnabled = !!enabled;
    return true;
  });
  sdk.api.register("analyzeHttpHistory", async () => {
    let analyzed = 0;
    let newFindings = 0;
    try {
      const patterns = [];
      for (const k of predefinedKeywords.high) patterns.push({ regex: buildFlexibleRegex(k), severity: "high" });
      for (const k of predefinedKeywords.medium) patterns.push({ regex: buildFlexibleRegex(k), severity: "medium" });
      for (const k of predefinedKeywords.low) patterns.push({ regex: buildFlexibleRegex(k), severity: "low" });
      const db = await sdk.meta.db();
      await db.exec("CREATE TABLE IF NOT EXISTS critical_keywords (keyword TEXT PRIMARY KEY)");
      const stmt = await db.prepare("SELECT keyword FROM critical_keywords");
      const rows = await stmt.all();
      for (const row of rows) {
        const keyword = row.keyword;
        if (keyword && typeof keyword === "string" && keyword.trim().length > 0) {
          patterns.push({ regex: buildFlexibleRegex(keyword), severity: "critical" });
        }
      }
      let enabledSeverities = { ...severityToggles };
      const searchApi = sdk.search;
      if (!searchApi || typeof searchApi.query !== "function") {
        sdk.console.warn("[Secret Detector] Search API is not available in this SDK version.");
        return { summary: "Search API not available in this SDK version." };
      }
      for (const { regex, severity } of patterns) {
        if (!enabledSeverities[severity]) continue;
        let keyword = "";
        if (regex && typeof regex.source === "string") {
          const split = regex.source.split("\\s*");
          keyword = split && split[0] ? split[0].replace(/[\[\]\\]/g, "") : "";
        }
        if (!keyword) continue;
        let results = [];
        try {
          results = await searchApi.query({
            query: keyword,
            type: "response",
            // or "body" if supported
            limit: 1e3
            // limit to avoid overload
          });
        } catch (err) {
          sdk.console.warn(`[Secret Detector] Search API error for keyword '${keyword}': ${err}`);
          continue;
        }
        for (const hit of results) {
          analyzed++;
          if (!hit || !hit.requestId) continue;
          try {
            const httpAny = sdk.http;
            if (!httpAny || typeof httpAny.getRequest !== "function" || typeof httpAny.getResponse !== "function") {
              continue;
            }
            const req = await httpAny.getRequest(hit.requestId);
            const res = await httpAny.getResponse(hit.requestId);
            if (!req || !res) continue;
            let body = "";
            try {
              const bodyObj = await res.getBody();
              if (bodyObj && typeof bodyObj.toText === "function") {
                body = await bodyObj.toText();
              }
            } catch {
            }
            const matches = [...body.matchAll(regex)];
            if (matches.length > 0) {
              const items = matches.map((m) => m[0]);
              const finding = {
                title: `[${severity.toUpperCase()}] Hardcoded Secrets Found!!`,
                description: `Potential ${severity}-severity secrets found in response from ${req.getUrl()} (search scan):

` + items.map((v, i) => `${i + 1}. ${v}`).join("\n"),
                reporter: "Secret Detector",
                dedupeKey: `${req.getUrl()}-secret-${severity}-search`,
                request: req,
                severity,
                items,
                url: req.getUrl(),
                timestamp: Date.now()
              };
              allFindings.push(finding);
              await sdk.findings.create(finding);
              newFindings++;
            }
          } catch (err) {
            sdk.console.warn(`[Secret Detector] Error processing search hit: ${err}`);
          }
        }
      }
      return { summary: `Analyzed ${analyzed} search hits. Created ${newFindings} new findings.` };
    } catch (err) {
      sdk.console.warn(`[Secret Detector] Error analyzing HTTP history via search: ${err}`);
      return { summary: `Error analyzing HTTP history via search: ${err}` };
    }
  });
  sdk.api.register("getExcludedExtensions", async () => {
    await loadExcludedExtensions(sdk);
    return excludedExtensions;
  });
  sdk.api.register("setExcludedExtensions", async (_sdk, exts) => {
    excludedExtensions = (exts || []).map((e) => typeof e === "string" ? e.trim().toLowerCase() : "").filter((e) => e.length > 0).map((e) => e.startsWith(".") ? e : "." + e);
    await saveExcludedExtensions(sdk);
    return true;
  });
  sdk.events.onInterceptResponse(async (sdk2, request, response) => {
    try {
      if (!toolEnabled) return;
      const rawUrl = request.getUrl && typeof request.getUrl === "function" ? request.getUrl() : "";
      const url = typeof rawUrl === "string" ? rawUrl.toLowerCase().split("?")[0] : "";
      for (const ext of excludedExtensions) {
        if (url && url.endsWith(ext)) {
          return;
        }
      }
      let enabledSeverities = { ...severityToggles };
      const bodyObj = await response.getBody();
      let body = "";
      if (bodyObj && typeof bodyObj.toText === "function") {
        body = await bodyObj.toText();
      }
      const patterns = [];
      for (const k of predefinedKeywords.high) patterns.push({ regex: buildFlexibleRegex(k), severity: "high" });
      for (const k of predefinedKeywords.medium) patterns.push({ regex: buildFlexibleRegex(k), severity: "medium" });
      for (const k of predefinedKeywords.low) patterns.push({ regex: buildFlexibleRegex(k), severity: "low" });
      const db = await sdk2.meta.db();
      await db.exec("CREATE TABLE IF NOT EXISTS critical_keywords (keyword TEXT PRIMARY KEY)");
      const stmt = await db.prepare("SELECT keyword FROM critical_keywords");
      const rows = await stmt.all();
      const loadedCritical = [];
      for (const row of rows) {
        const keyword = row.keyword;
        if (keyword && typeof keyword === "string" && keyword.trim().length > 0) {
          patterns.push({
            regex: buildFlexibleRegex(keyword),
            severity: "critical"
          });
          loadedCritical.push(keyword);
        }
      }
      sdk2.console.log(`[Secret Detector] Loaded critical keywords: ${JSON.stringify(loadedCritical)}`);
      const matchesBySeverity = {
        low: [],
        medium: [],
        high: [],
        critical: []
      };
      for (const { regex, severity } of patterns) {
        const matches = [...body.matchAll(regex)];
        for (const m of matches) matchesBySeverity[severity].push(m[0]);
      }
      for (const severity of ["high", "medium", "low", "critical"]) {
        if (!enabledSeverities[severity]) continue;
        const items = matchesBySeverity[severity];
        if (items.length === 0) continue;
        const finding = {
          title: `[${severity.toUpperCase()}] Hardcoded Secrets Found!!`,
          description: `Potential ${severity}-severity secrets found in response from ${request.getUrl()} (live scan):

` + items.map((v, i) => `${i + 1}. ${v}`).join("\n"),
          reporter: "Secret Detector",
          dedupeKey: `${request.getUrl()}-secret-${severity}-live`,
          request,
          severity,
          items,
          url: request.getUrl(),
          timestamp: Date.now()
        };
        allFindings.push(finding);
        await sdk2.findings.create(finding);
      }
    } catch (err) {
      sdk2.console.warn(`[Secret Detector] Error in onInterceptResponse: ${err}`);
    }
  });
}
export {
  init
};
