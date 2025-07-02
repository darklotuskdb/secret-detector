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
  "aws_secret_access_key",
  "aws_secret",
  "aws_secret_key",
  "awssecretkey",
  "secret_key",
  "encryption_key",
  "encryption_password",
  "private_key",
  "client_secret",
  "db_password",
  "database_password",
  "certificate_password",
  "cloudinary_api_secret",
  "docker_password",
  "dockerhub_password",
  "bintray_gpg_password",
  "digitalocean_ssh_key_body",
  "digitalocean_ssh_key_ids",
  "aes_secret_key",
  "elasticsearch_password",
  "env_heroku_api_key",
  "env_sonatype_password",
  "payment_key",
  "access_token",
  "auth_token",
  "authorizationtoken",
  "secret_token",
  "firebase_token",
  "token",
  "bx_password",
  "dbpasswd",
  "dbpassword",
  "droplet_travis_password",
  "ci_deploy_password",
  "deploy_password",
  "cloudant_password",
  "cloudflare_api_key",
  "cloudflare_auth_key",
  "clojars_password",
  "ansible_vault_password",
  "cattle_secret_key",
  "cloud_watch_aws_access_key",
  "consumer_secret",
  "dynamosecretaccesskey",
  "seckey",
  "firebase",
  "forgerock",
  "conn_login",
  "deploy_key",
  "database_url",
  "api_key",
  "app_key",
  "app_secret",
  "application_key",
  "access_key",
  "aws_access_key_id",
  "aws_key",
  "b2_app_key",
  "algolia_api_key",
  "algolia_admin_key",
  "docker_key",
  "docker_pass",
  "docker_passwd",
  "bintray_apikey",
  "bintray_key",
  "browserstack_access_key",
  "cache_s3_secret_key",
  "bucketeer_aws_access_key_id",
  "bucketeer_aws_secret_access_key",
  "codecov_token",
  "cypress_record_key",
  "datadog_api_key",
  "datadog_app_key",
  "db_username",
  "db_user",
  "consumer_key",
  "cloud_api_key",
  "client_zpk_secret_key",
  "app_id",
  "app_log_level",
  "cache_driver",
  "app_debug",
  "config",
  "connectionstring",
  "credentials",
  "elastica_host",
  "elastica_port",
  "groov",
  "dot_files",
  "cloudinary_name",
  "database_schema_test",
  "db_server",
  "project_id",
  "bucket",
  "client_id",
  "public_key",
  "user_id",
  "user_key",
  "dev_id",
  "dev_key"
];
var cachedPatterns = [];
var cachedCriticalKeywords = [];
function rebuildPatternCache(criticalKeywords = cachedCriticalKeywords) {
  cachedPatterns = [];
  for (const k of predefinedKeywords) cachedPatterns.push({ regex: buildFlexibleRegex(k), keyword: k });
  for (const k of criticalKeywords) cachedPatterns.push({ regex: buildFlexibleRegex(k), keyword: k });
  cachedCriticalKeywords = [...criticalKeywords];
}
rebuildPatternCache();
var allFindings = [];
var foundKeywordValue = /* @__PURE__ */ new Set();
var foundHostPath = /* @__PURE__ */ new Set();
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
      for (const { regex, keyword } of patterns) {
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
              if (valueMatch && valueMatch[1] && valueMatch[1].length > 5) {
                const dedupeKey = `${keyword}::${valueMatch[1]}`;
                if (!foundKeywordValue.has(dedupeKey)) {
                  foundKeywordValue.add(dedupeKey);
                  return true;
                }
              }
              return false;
            });
            if (matches.length > 0) {
              let hostPath = "";
              let url = req.getUrl();
              try {
                const u = new globalThis.URL(url);
                hostPath = u.host + u.pathname;
              } catch {
                hostPath = url || "";
              }
              if (foundHostPath.has(hostPath)) continue;
              foundHostPath.add(hostPath);
              const items = matches.map((m) => m[0]);
              const finding = {
                title: `[SECRETS] Hardcoded Secrets Found!!`,
                description: `Potential secrets found in response from ${url} (search scan):

` + items.map((v, i) => `${i + 1}. ${v}`).join("\n"),
                reporter: "Secret Detector",
                dedupeKey: `${url}-secret-search`,
                request: req,
                items,
                url,
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
      let hostPath = "";
      try {
        const u = new globalThis.URL(rawUrl);
        hostPath = u.host + u.pathname;
      } catch {
        hostPath = rawUrl || "";
      }
      if (foundHostPath.has(hostPath)) return;
      foundHostPath.add(hostPath);
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
          return valueMatch && valueMatch[1] && valueMatch[1].length > 5;
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
