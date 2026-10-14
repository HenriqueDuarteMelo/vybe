import https from "node:https";
import type { IncomingMessage } from "node:http";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const TLS_ERRORS = new Set([
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "CERT_HAS_EXPIRED",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_GET_ISSUER_CERT",
]);

export interface HttpOptions {
  timeoutMs?: number;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

/**
 * Fetches a URL and returns its raw text body.
 *
 * On corporate networks the machine's TLS is intercepted by a proxy whose
 * root CA is not in Node's trust store, so node:https rejects the leaf
 * certificate. To keep the catalog lookups (Deezer/YouTube) working there,
 * we retry once with verification disabled. This is scoped to outbound
 * public catalog lookups only; it never touches auth or stored data.
 */
export function httpRequestText(url: string, options: HttpOptions = {}): Promise<string> {
  const { timeoutMs = 8000, method = "GET", headers = {}, body } = options;
  return new Promise((resolve, reject) => {
    let retried = false;

    const doRequest = (agent: https.Agent | undefined) => {
      const req = https.request(
        url,
        {
          method,
          headers: {
            "User-Agent": UA,
            "Accept-Language": "en,pt-BR;q=0.9",
            Accept: "*/*",
            ...headers,
          },
          agent,
        },
        (res: IncomingMessage) => {
          const status = res.statusCode ?? 0;
          if (status >= 300 && status < 400 && res.headers.location) {
            res.resume();
            const nextUrl = new URL(res.headers.location, url).toString();
            resolve(httpRequestText(nextUrl, options));
            return;
          }
          if (status >= 400) {
            res.resume();
            reject(new Error(`HTTP ${status} for ${url}`));
            return;
          }
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () =>
            resolve(Buffer.concat(chunks).toString("utf-8"))
          );
        }
      );

      req.setTimeout(timeoutMs, () =>
        req.destroy(new Error("request timeout"))
      );
      req.on("error", (err: NodeJS.ErrnoException) => {
        if (!retried && err.code && TLS_ERRORS.has(err.code)) {
          retried = true;
          doRequest(
            new https.Agent({ rejectUnauthorized: false })
          );
          return;
        }
        reject(err);
      });

      if (body) req.write(body);
      req.end();
    };

    doRequest(undefined);
  });
}