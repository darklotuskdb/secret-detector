// packages/backend/src/index.ts
function buildFlexibleRegex(keyword) {
  const escaped = keyword.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  const flexible = escaped.replace(/_/g, "[_-\\s]");
  return new RegExp(
    `${flexible}\\s*[:=]\\s*['"][^'"]+['"]`,
    "gi"
  );
}
var predefinedKeywords = [
  // Cloud provider keys
  "AWS_SECRET_ACCESS_KEY",
  "AWS_ACCESS_KEY_ID",
  "GCP_API_KEY",
  "AZURE_CLIENT_SECRET",
  // Generic secrets
  "PRIVATE_KEY",
  "SECRET_KEY",
  "ENCRYPTION_KEY",
  "API_KEY",
  "ACCESS_TOKEN",
  "REFRESH_TOKEN",
  "AUTH_TOKEN",
  "SESSION_ID",
  // Database/credentials
  "DATABASE_URL",
  "DB_PASSWORD",
  "SMTP_PASSWORD",
  "MAILGUN_API_KEY",
  // Service tokens
  "SLACK_TOKEN",
  "GITHUB_TOKEN",
  // User info (for demo, can be removed if not needed)
  "PASSWORD",
  "USERNAME",
  "EMAIL",
  "PHONE_NUMBER",
  "ADDRESS",
  "ZIP_CODE",
  "CITY",
  "COUNTRY"
];
var cachedPatterns = [];
var cachedCriticalKeywords = [];
function rebuildPatternCache(criticalKeywords = cachedCriticalKeywords) {
  cachedPatterns = [];
  for (const k of predefinedKeywords) cachedPatterns.push({ regex: buildFlexibleRegex(k) });
  for (const k of criticalKeywords) cachedPatterns.push({ regex: buildFlexibleRegex(k) });
  cachedCriticalKeywords = [...criticalKeywords];
}
rebuildPatternCache();
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
  sdk.api.register("getPredefinedKeywords", async () => {
    return predefinedKeywords;
  });
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
    rebuildPatternCache(keywords);
    return true;
  });
  sdk.api.register("setPredefinedKeywords", async (_sdk, keywords) => {
    if (Array.isArray(keywords) && keywords.length > 0) {
      predefinedKeywords = Array.from(/* @__PURE__ */ new Set([...predefinedKeywords, ...keywords]));
      sdk.console.log(`[Secret Detector] Predefined keywords updated: count=${predefinedKeywords.length}`);
      rebuildPatternCache(cachedCriticalKeywords);
    }
    return true;
  });
  sdk.api.register("getAllFindings", async () => {
    return allFindings;
  });
  sdk.api.register("getKeywordStats", async () => {
    const keywordCounts = {};
    for (const finding of allFindings) {
      if (Array.isArray(finding.items)) {
        for (const kw of finding.items) {
          if (typeof kw === "string") {
            keywordCounts[kw] = (keywordCounts[kw] || 0) + 1;
          }
        }
      }
    }
    const keywords = [];
    for (const [kw, count] of Object.entries(keywordCounts)) {
      keywords.push({ keyword: kw, count });
    }
    keywords.sort((a, b) => b.count - a.count);
    return { stats: {}, keywords };
  });
  sdk.api.register("setToolEnabled", async (_sdk, enabled) => {
    toolEnabled = !!enabled;
    return true;
  });
  sdk.api.register("analyzeHttpHistory", async () => {
    let analyzed = 0;
    let newFindings = 0;
    try {
      const patterns = cachedPatterns;
      const searchApi = sdk.search;
      if (!searchApi || typeof searchApi.query !== "function") {
        sdk.console.warn("[Secret Detector] Search API is not available in this SDK version.");
        return { summary: "Search API not available in this SDK version." };
      }
      for (const { regex } of patterns) {
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
            const matches = [...body.matchAll(regex)].filter((m) => {
              const match = m[0];
              const valueMatch = match.match(/[:=]\s*['\"]([^'\"]+)['\"]/);
              if (valueMatch && valueMatch[1] && valueMatch[1].length > 5) return true;
              return false;
            });
            if (matches.length > 0) {
              const items = matches.map((m) => m[0]);
              const finding = {
                title: `[SECRETS] Hardcoded Secrets Found!!`,
                description: `Potential secrets found in response from ${req.getUrl()} (search scan):

` + items.map((v, i) => `${i + 1}. ${v}`).join("\n"),
                reporter: "Secret Detector",
                dedupeKey: `${req.getUrl()}-secret-search`,
                request: req,
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
      const bodyObj = await response.getBody();
      let body = "";
      if (bodyObj && typeof bodyObj.toText === "function") {
        body = await bodyObj.toText();
      }
      const patterns = cachedPatterns;
      let found = [];
      for (const { regex } of patterns) {
        const matches = [...body.matchAll(regex)].filter((m) => {
          const match = m[0];
          const valueMatch = match.match(/[:=]\s*['\"]([^'\"]+)['\"]/);
          if (valueMatch && valueMatch[1] && valueMatch[1].length > 5) return true;
          return false;
        });
        for (const m of matches) found.push(m[0]);
      }
      if (found.length > 0) {
        const finding = {
          title: `[SECRETS] Hardcoded Secrets Found!!`,
          description: `Potential secrets found in response from ${request.getUrl()} (live scan):

` + found.map((v, i) => `${i + 1}. ${v}`).join("\n"),
          reporter: "Secret Detector",
          dedupeKey: `${request.getUrl()}-secret-live`,
          request,
          items: found,
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
