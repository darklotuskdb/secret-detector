import type { DefineAPI, SDK } from "caido:plugin";
import type { Request, Response } from "caido:utils";

export type API = DefineAPI<{}>;

export function init(sdk: SDK<API>) {
  sdk.events.onInterceptResponse(async (sdk, request: Request, response: Response) => {
    try {
      const buffer = await response.getBody();
      const body = Buffer.from(buffer).toString("utf8"); // ✅ Caido-compatible

      const fullUrl = request.getUrl() + request.getQuery();

      const secretRegex = /(api[-_]?key)\s*[:=]\s*['"]?[\w\-\.@:/]{8,}['"]?/gi;

      const bodyMatch = secretRegex.test(body);
      const urlMatch = secretRegex.test(fullUrl);

      if (bodyMatch || urlMatch) {
        await sdk.findings.create({
          title: "Hardcoded secrets found",
          description: `Potential hardcoded API key found in response from ${request.getUrl()}.`,
          reporter: "secret-scan",
          dedupeKey: `${request.getUrl()}-secret`,
          request,
          response,
        });
      }
    } catch (error) {
      sdk.console.warn(`Error analyzing response from ${request.getUrl()}: ${error}`);
    }
  });
}
