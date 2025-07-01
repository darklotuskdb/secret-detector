import type { DefineAPI, SDK } from "caido:plugin";
import type { Request, Response } from "caido:utils";

export type API = DefineAPI<{
  getCriticalKeywords: () => Promise<string[]>;
  setCriticalKeywords: (keywords: string[]) => Promise<boolean>;
  getPredefinedKeywords: () => Promise<string[]>;
  setPredefinedKeywords: (keywords: string[]) => Promise<boolean>;
  // Removed setSeverityToggles/getSeverityToggles from API
  getAllFindings: () => Promise<any[]>;
  getKeywordStats: () => Promise<{ stats: Record<string, number>; keywords: Array<{ keyword: string; count: number }> }>;
  setToolEnabled: (enabled: boolean) => Promise<boolean>;
  analyzeHttpHistory: () => Promise<{ summary: string }>;
  getExcludedExtensions: () => Promise<string[]>;
  setExcludedExtensions: (exts: string[]) => Promise<boolean>;
}>;

type SecretPattern = {
  regex: RegExp;
};

// Helper to build a flexible regex for a keyword
function buildFlexibleRegex(keyword: string): RegExp {
  // Replace _ with [_\-\s] to match _, -, or space
  // Escape all regex special chars except _
  const escaped = keyword.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  const flexible = escaped.replace(/_/g, "[_\-\\s]");
  // Match key optionally surrounded by spaces, then :=, then quoted value
  return new RegExp(
    `${flexible}\\s*[:=]\\s*['\"][^'\"]+['\"]`,
    "gi"
  );
}

// In-memory storage for all predefined keywords (no severity)
let predefinedKeywords: string[] = [
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

// In-memory cache for regex patterns (predefined + critical)
let cachedPatterns: SecretPattern[] = [];
let cachedCriticalKeywords: string[] = [];
function rebuildPatternCache(criticalKeywords: string[] = cachedCriticalKeywords) {
  cachedPatterns = [];
  for (const k of predefinedKeywords) cachedPatterns.push({ regex: buildFlexibleRegex(k) });
  for (const k of criticalKeywords) cachedPatterns.push({ regex: buildFlexibleRegex(k) });
  cachedCriticalKeywords = [...criticalKeywords];
}

// Ensure regex cache is initialized at startup
rebuildPatternCache();

// (Removed severity toggles, not needed)

// In-memory storage for findings (for export)
let allFindings: any[] = [];

// Global toggle for enabling/disabling the tool
let toolEnabled = true;

// In-memory storage for excluded file extensions (e.g., [".png", ".jpg"])
let excludedExtensions: string[] = [];

// Helper to load/save excluded extensions from SQLite
async function loadExcludedExtensions(sdk: SDK<API>) {
  const db = await sdk.meta.db();
  await db.exec("CREATE TABLE IF NOT EXISTS excluded_extensions (ext TEXT PRIMARY KEY)");
  const stmt = await db.prepare("SELECT ext FROM excluded_extensions");
  const rows = await stmt.all();
  excludedExtensions = rows.map((r: any) => r.ext);
}
async function saveExcludedExtensions(sdk: SDK<API>) {
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

export function init(sdk: SDK<API>) {
  // Register API to get all predefined keywords (no severity)
  sdk.api.register("getPredefinedKeywords", async () => {
    return predefinedKeywords;
  });
  // Load excluded extensions on startup
  loadExcludedExtensions(sdk);

  // Register backend API for frontend to get/set critical keywords
  sdk.api.register("getCriticalKeywords", async () => {
    const db = await sdk.meta.db();
    await db.exec("CREATE TABLE IF NOT EXISTS critical_keywords (keyword TEXT PRIMARY KEY)");
    const stmt = await db.prepare("SELECT keyword FROM critical_keywords");
    const rows = await stmt.all();
    return rows.map((r: any) => r.keyword);
  });
  sdk.api.register("setCriticalKeywords", async (_sdk, keywords: string[]) => {
    const db = await sdk.meta.db();
    await db.exec("CREATE TABLE IF NOT EXISTS critical_keywords (keyword TEXT PRIMARY KEY)");
    await db.exec("DELETE FROM critical_keywords");
    for (const kw of keywords) {
      if (kw && typeof kw === "string") {
        const stmt = await db.prepare("INSERT OR IGNORE INTO critical_keywords (keyword) VALUES (?)");
        await stmt.run(kw);
      }
    }
    // Rebuild pattern cache with new critical keywords
    rebuildPatternCache(keywords);
    return true;
  });

  // Register API to set predefined keywords (from frontend)
  sdk.api.register("setPredefinedKeywords", async (_sdk, keywords: string[]) => {
    if (Array.isArray(keywords) && keywords.length > 0) {
      // Merge new keywords with existing, deduplicate
      predefinedKeywords = Array.from(new Set([...predefinedKeywords, ...keywords]));
      // Store in-memory only (no DB), so will reset on restart
      sdk.console.log(`[Secret Detector] Predefined keywords updated: count=${predefinedKeywords.length}`);
      // Rebuild pattern cache with current critical keywords
      rebuildPatternCache(cachedCriticalKeywords);
    }
    return true;
  });
  // (Removed setSeverityToggles/getSeverityToggles, not needed)
  sdk.api.register("getAllFindings", async () => {
    return allFindings;
  });
  sdk.api.register("getKeywordStats", async () => {
    // Simple keyword count (no severity)
    const keywordCounts: Record<string, number> = {};
    for (const finding of allFindings) {
      if (Array.isArray(finding.items)) {
        for (const kw of finding.items) {
          if (typeof kw === "string") {
            keywordCounts[kw] = (keywordCounts[kw] || 0) + 1;
          }
        }
      }
    }
    // Flatten to array: { keyword, count }
    const keywords: { keyword: string; count: number }[] = [];
    for (const [kw, count] of Object.entries(keywordCounts)) {
      keywords.push({ keyword: kw, count });
    }
    keywords.sort((a, b) => b.count - a.count);
    return { stats: {}, keywords };
  });

  // Register API to enable/disable the tool
  sdk.api.register("setToolEnabled", async (_sdk, enabled: boolean) => {
    toolEnabled = !!enabled;
    return true;
  });

  // Register API to analyze past HTTP history
  sdk.api.register("analyzeHttpHistory", async () => {
    // Use Caido's search/filtering API to scan for secrets in past HTTP traffic
    let analyzed = 0;
    let newFindings = 0;
    try {
      // Use cached patterns for performance
      const patterns: SecretPattern[] = cachedPatterns;
      // Check if search API is available
      const searchApi = (sdk as any).search;
      if (!searchApi || typeof searchApi.query !== "function") {
        sdk.console.warn("[Secret Detector] Search API is not available in this SDK version.");
        return { summary: "Search API not available in this SDK version." };
      }
      // For each pattern, search for hits in HTTP traffic
      for (const { regex } of patterns) {
        // Extract the keyword from the regex source (best effort, safe)
        let keyword = "";
        if (regex && typeof regex.source === "string") {
          const split = regex.source.split("\\s*");
          keyword = (split && split[0]) ? split[0].replace(/[\[\]\\]/g, "") : "";
        }
        if (!keyword) continue;
        // Search using the SDK's search API
        let results: any[] = [];
        try {
          results = await searchApi.query({
            query: keyword,
            type: "response", // or "body" if supported
            limit: 1000, // limit to avoid overload
          });
        } catch (err) {
          sdk.console.warn(`[Secret Detector] Search API error for keyword '${keyword}': ${err}`);
          continue;
        }
        for (const hit of results) {
          analyzed++;
          // Defensive: ensure hit has request/response
          if (!hit || !hit.requestId) continue;
          try {
            // Fetch the request/response by ID using safe access
            const httpAny = (sdk as any).http;
            if (!httpAny || typeof httpAny.getRequest !== "function" || typeof httpAny.getResponse !== "function") { continue; }
            const req = await httpAny.getRequest(hit.requestId);
            const res = await httpAny.getResponse(hit.requestId);
            if (!req || !res) continue;
            let body = "";
            try {
              const bodyObj = await res.getBody();
              if (bodyObj && typeof bodyObj.toText === "function") {
                body = await bodyObj.toText();
              }
            } catch {}
            // Run the regex pattern on the body
            const matches = [...body.matchAll(regex)].filter(m => {
              // m[0] is the full match, m[1] is undefined unless regex has groups
              // Extract the value after := or =,
              const match = m[0];
              // Try to extract the value part (after := or = and quotes)
              const valueMatch = match.match(/[:=]\s*['\"]([^'\"]+)['\"]/);
              if (valueMatch && valueMatch[1] && valueMatch[1].length > 5) return true;
              return false;
            });
            if (matches.length > 0) {
              const items = matches.map(m => m[0]);
              const finding = {
                title: `[SECRETS] Hardcoded Secrets Found!!`,
                description:
                  `Potential secrets found in response from ${req.getUrl()} (search scan):\n\n` +
                  items.map((v, i) => `${i + 1}. ${v}`).join("\n"),
                reporter: "Secret Detector",
                dedupeKey: `${req.getUrl()}-secret-search`,
                request: req,
                items,
                url: req.getUrl(),
                timestamp: Date.now(),
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

  // Register API to get/set excluded extensions
  sdk.api.register("getExcludedExtensions", async () => {
    await loadExcludedExtensions(sdk);
    return excludedExtensions;
  });
  sdk.api.register("setExcludedExtensions", async (_sdk, exts: string[]) => {
    // Normalize: trim, lowercase, ensure starts with .
    excludedExtensions = (exts || [])
      .map(e => (typeof e === "string" ? e.trim().toLowerCase() : ""))
      .filter(e => e.length > 0)
      .map(e => (e.startsWith(".") ? e : "." + e));
    await saveExcludedExtensions(sdk);
    return true;
  });

  sdk.events.onInterceptResponse(async (sdk: SDK<API>, request: Request, response: Response) => {
    try {
      if (!toolEnabled) return;
      // Exclude requests with excluded extensions
      const rawUrl = request.getUrl && typeof request.getUrl === "function" ? request.getUrl() : "";
      const url = typeof rawUrl === "string" ? rawUrl.toLowerCase().split("?")[0] : "";
      for (const ext of excludedExtensions) {
        if (url && url.endsWith(ext)) { return; }
      }

      const bodyObj = await response.getBody();
      let body: string = "";
      if (bodyObj && typeof bodyObj.toText === "function") {
        body = await bodyObj.toText();
      }

      // Use cached patterns for performance
      const patterns: SecretPattern[] = cachedPatterns;
      // Collect all matches (no severity)
      let found: string[] = [];
      for (const { regex } of patterns) {
        const matches = [...body.matchAll(regex)].filter(m => {
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
          description:
            `Potential secrets found in response from ${request.getUrl()} (live scan):\n\n` +
            found.map((v, i) => `${i + 1}. ${v}`).join("\n"),
          reporter: "Secret Detector",
          dedupeKey: `${request.getUrl()}-secret-live`,
          request,
          items: found,
          url: request.getUrl(),
          timestamp: Date.now(),
        };
        allFindings.push(finding);
        await sdk.findings.create(finding);
      }
    } catch (err) {
      sdk.console.warn(`[Secret Detector] Error in onInterceptResponse: ${err}`);
    }
  });
}