import type { DefineAPI, SDK } from "caido:plugin";
import type { Request, Response } from "caido:utils";

export type API = DefineAPI<{}>;

type SecretPattern = {
  regex: RegExp;
  severity: "low" | "medium" | "high";
};

export function init(sdk: SDK<API>) {
  sdk.events.onInterceptResponse(async (sdk, request: Request, response: Response) => {
    try {
      const buffer = await response.getBody();
      const body = Buffer.from(buffer).toString("utf8");

      const patterns: SecretPattern[] = [
        // { regex: /(FIREBASE_TOKEN)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "medium" },
        // { regex: /(access[-_]?token)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "low" },
        // { regex: /(secret[-_]?token)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "medium" },
        // { regex: /(secret[-_]?key)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "high" },
        // all high severity keywords
        { regex: /(aws[_-]?secret[_-]?access[_-]?key)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "high" },
        { regex: /(aws[_-]?secret)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "high" },
        { regex: /(aws[_-]?secret[_-]?key)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "high" },
        { regex: /(AWSSecretKey)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "high" },
        { regex: /(secret[_-]?key)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "high" },
        { regex: /(encryption[_-]?key)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "high" },
        { regex: /(encryption[_-]?password)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "high" },
        { regex: /(private[_-]?key)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "high" },
        { regex: /(client[_-]?secret)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "high" },
        { regex: /(db[_-]?password)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "high" },
        { regex: /(database[_-]?password)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "high" },
        { regex: /(certificate[_-]?password)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "high" },
        { regex: /(cloudinary[_-]?api[_-]?secret)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "high" },
        { regex: /(docker[_-]?password)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "high" },
        { regex: /(dockerhub[_-]?password)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "high" },
        { regex: /(bintray[_-]?gpg[_-]?password)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "high" },
        { regex: /(digitalocean[_-]?ssh[_-]?key[_-]?body)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "high" },
        { regex: /(digitalocean[_-]?ssh[_-]?key[_-]?ids)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "high" },
        { regex: /(aes[_-]?secret[_-]?key)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "high" },
        { regex: /(elasticsearch[_-]?password)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "high" },
        { regex: /(env[-_]?heroku[-_]?api[-_]?key)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "high" },
        { regex: /(env[-_]?sonatype[-_]?password)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "high" },

        // all medium severity keywords
        { regex: /(access[_-]?token)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "medium" },
        { regex: /(auth[_-]?token)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "medium" },
        { regex: /(authorizationToken)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "medium" },
        { regex: /(secret[_-]?token)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "medium" },
        { regex: /(firebase[_-]?token)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "medium" },
        { regex: /(token)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "medium" },
        { regex: /(bx[_-]?password)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "medium" },
        { regex: /(dbpasswd)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "medium" },
        { regex: /(dbpassword)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "medium" },
        { regex: /(droplet[_-]?travis[_-]?password)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "medium" },
        { regex: /(ci[_-]?deploy[_-]?password)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "medium" },
        { regex: /(deploy[_-]?password)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "medium" },
        { regex: /(cloudant[_-]?password)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "medium" },
        { regex: /(cloudflare[_-]?api[_-]?key)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "medium" },
        { regex: /(cloudflare[_-]?auth[_-]?key)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "medium" },
        { regex: /(clojars[_-]?password)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "medium" },
        { regex: /(ansible[_-]?vault[_-]?password)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "medium" },
        { regex: /(cattle[_-]?secret[_-]?key)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "medium" },
        { regex: /(cloud[_-]?watch[_-]?aws[_-]?access[_-]?key)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "medium" },
        { regex: /(consumer[_-]?secret)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "medium" },
        { regex: /(dynamosecretaccesskey)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "medium" },
        { regex: /(secKey)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "medium" },
        { regex: /(firebase)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "medium" },
        { regex: /(forgerock)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "medium" },
        { regex: /(conn[-_]?login)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "medium" },
        { regex: /(deploy[-_]?key)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "medium" },
        { regex: /(database[-_]?url)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "medium" },

        // all low severity keywords
        { regex: /(api[_-]?key)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "low" },
        { regex: /(apikey)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "low" },
        { regex: /(app[_-]?key)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "low" },
        { regex: /(app[_-]?secret)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "low" },
        { regex: /(application[_-]?key)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "low" },
        { regex: /(access[_-]?key)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "low" },
        { regex: /(aws[_-]?access[_-]?key[_-]?id)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "low" },
        { regex: /(aws[_-]?key)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "low" },
        { regex: /(b2[_-]?app[_-]?key)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "low" },
        { regex: /(algolia[_-]?api[_-]?key)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "low" },
        { regex: /(algolia[_-]?admin[_-]?key)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "low" },
        { regex: /(docker[_-]?key)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "low" },
        { regex: /(docker[_-]?pass)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "low" },
        { regex: /(docker[_-]?passwd)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "low" },
        { regex: /(bintray[_-]?apikey)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "low" },
        { regex: /(bintray[_-]?key)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "low" },
        { regex: /(browserstack[_-]?access[_-]?key)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "low" },
        { regex: /(cache[_-]?s3[_-]?secret[_-]?key)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "low" },
        { regex: /(bucketeer[_-]?aws[_-]?access[_-]?key[_-]?id)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "low" },
        { regex: /(bucketeer[_-]?aws[_-]?secret[_-]?access[_-]?key)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "low" },
        { regex: /(codecov[_-]?token)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "low" },
        { regex: /(cypress[_-]?record[_-]?key)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "low" },
        { regex: /(datadog[_-]?api[_-]?key)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "low" },
        { regex: /(datadog[_-]?app[_-]?key)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "low" },
        { regex: /(db[_-]?username)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "low" },
        { regex: /(db[_-]?user)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "low" },
        { regex: /(consumer[_-]?key)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "low" },
        { regex: /(cloud[_-]?api[_-]?key)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "low" },
        { regex: /(client[_-]?zpk[_-]?secret[_-]?key)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "low" },
        { regex: /(app[_-]?id)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "low" },
        { regex: /(app[_-]?log[_-]?level)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "low" },
        { regex: /(cache[_-]?driver)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "low" },
        { regex: /(app[_-]?debug)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "low" },
        { regex: /(config)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "low" },
        { regex: /(connectionstring)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "low" },
        { regex: /(credentials)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "low" },
        { regex: /(elastica[_-]?host)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "low" },
        { regex: /(elastica[_-]?port)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "low" },
        { regex: /(groov)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "low" },
        { regex: /(dot[-_]?files)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "low" },
        { regex: /(cloudinary[-_]?name)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "low" },
        { regex: /(database[-_]?schema[-_]?test)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "low" },
        { regex: /(db[-_]?server)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "low" },
        { regex: /(project[-_]?id)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "low" },
        { regex: /(bucket)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "low" },
        { regex: /(client[-_]?id)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "low" },
        { regex: /(public[-_]?key)\s*[:=]\s*['"][^'"]+['"]/gi, severity: "low" },
      ];

      const matchesBySeverity: Record<"low" | "medium" | "high", string[]> = {
        low: [],
        medium: [],
        high: [],
      };

      for (const { regex, severity } of patterns) {
        const matches = [...body.matchAll(regex)];
        for (const m of matches) matchesBySeverity[severity].push(m[0]);
      }

      for (const severity of ["high", "medium", "low"] as const) {
        const items = matchesBySeverity[severity];
        if (items.length > 0) {
          await sdk.findings.create({
            title: `[${severity.toUpperCase()}] Hardcoded Secrets Found!!`,
            severity,
            description:
              `Potential ${severity}-severity secrets found in response from ${request.getUrl()}:\n\n` +
              items.map((v, i) => `${i + 1}. ${v}`).join("\n"),
            reporter: "Secret Detector",
            dedupeKey: `${request.getUrl()}-secret-${severity}`,
            request,
            response,
          });
        }
      }
    } catch (err) {
      sdk.console.warn(`Error scanning response from ${request.getUrl()}: ${err}`);
    }
  });
}
