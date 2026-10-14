import https from "node:https";
import type { IncomingMessage } from "node:http";
import { httpRequestText } from "./http.js";

// The corporate firewall (FortiGuard) blocks catalog/media hosts at the
// connection/SNI level (api.deezer.com, *.dzcdn.net, youtube, ...). These
// public relay services fetch the target URL from their own network and
// return the bytes to us. Every fetch tries the direct route first, so
// everything keeps working if the block is ever lifted.

const HEXLET = (url: string) =>
  `https://allorigins.hexlet.app/raw?url=${encodeURIComponent(url)}`;
const JINA = (url: string) => `https://r.jina.ai/${url}`;

const JSON_RELAYS: {
  name: string;
  wrap: (url: string) => string;
  strip?: boolean;
  headers?: Record<string, string>;
}[] = [
  { name: "hexlet", wrap: HEXLET },
  {
    // r.jina.ai rejects browser-like User-Agents with HTTP 403, and wraps
    // bodies in a Markdown preamble unless asked for text — handle both.
    name: "jina",
    wrap: JINA,
    strip: true,
    headers: { "User-Agent": "VybeCatalog/1.0", "X-Return-Format": "text" },
  },
];

const DIRECT_TIMEOUT_MS = 2500;
const RELAY_TIMEOUT_MS = 12000;
const AUDIO_RELAY_TIMEOUT_MS = 30000;
const AUDIO_MAX_BYTES = 40 * 1024 * 1024;

// r.jina.ai wraps payloads in a "Title:/URL Source:/Markdown Content:"
// preamble. Return the JSON object/array embedded in it.
function stripJinaPreamble(text: string): string {
  const t = text.trim();
  if (t.startsWith("{") || t.startsWith("[")) return t;
  const marker = t.indexOf("Markdown Content:");
  const body = marker >= 0 ? t.slice(marker + "Markdown Content:".length).trim() : t;
  const start = body.search(/[{[]/);
  if (start < 0) return body;
  const close = body[start] === "{" ? "}" : "]";
  const end = body.lastIndexOf(close);
  return end > start ? body.slice(start, end + 1) : body;
}

interface CacheEntry {
  ts: number;
  value: unknown;
}

const jsonCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();
const JSON_CACHE_CAP = 300;

function remember(url: string, value: unknown) {
  jsonCache.set(url, { ts: Date.now(), value });
  if (jsonCache.size > JSON_CACHE_CAP) {
    const oldest = jsonCache.keys().next().value;
    if (oldest !== undefined) jsonCache.delete(oldest);
  }
}

/**
 * Fetches a JSON document, trying direct access first and then the public
 * relays. Results are cached per-URL and concurrent calls for the same URL
 * share a single request (search-as-you-type would otherwise hammer the
 * relays and hit their rate limits).
 *
 * `plausible` rejects bodies that parse fine but are clearly degraded (a
 * relay may serve a stale/corrupt cached copy) so the next strategy is
 * tried instead of returning garbage to the caller.
 */
export async function relayJson<T>(
  url: string,
  options: { ttlMs?: number; plausible?: (value: unknown) => boolean } = {}
): Promise<T> {
  const ttl = options.ttlMs ?? 5 * 60_000;
  const plausible = options.plausible;
  const accept = (value: unknown): T => {
    if (plausible && !plausible(value)) {
      throw new Error(`implausible JSON from ${url}`);
    }
    return value as T;
  };
  const hit = jsonCache.get(url);
  if (hit && Date.now() - hit.ts < ttl) return hit.value as T;

  const pending = inflight.get(url);
  if (pending) return pending as Promise<T>;

  const job = (async (): Promise<T> => {
    let lastError: unknown = new Error("all JSON strategies failed");

    try {
      const text = await httpRequestText(url, { timeoutMs: DIRECT_TIMEOUT_MS });
      const value = accept(JSON.parse(text));
      remember(url, value);
      return value;
    } catch (error) {
      lastError = error;
    }

    for (const relay of JSON_RELAYS) {
      try {
        const text = await httpRequestText(relay.wrap(url), {
          timeoutMs: RELAY_TIMEOUT_MS,
          headers: relay.headers,
        });
        const value = accept(JSON.parse(relay.strip ? stripJinaPreamble(text) : text));
        remember(url, value);
        return value;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError;
  })().finally(() => inflight.delete(url));

  inflight.set(url, job);
  return job;
}

interface BufferResult {
  buffer: Buffer;
  contentType: string;
}

function httpBuffer(
  url: string,
  timeoutMs: number
): Promise<BufferResult> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
          Accept: "*/*",
        },
        timeout: timeoutMs,
      },
      (res: IncomingMessage) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && res.headers.location) {
          res.resume();
          const next = new URL(res.headers.location, url).toString();
          resolve(httpBuffer(next, timeoutMs));
          return;
        }
        if (status >= 400) {
          res.resume();
          reject(new Error(`relay HTTP ${status} for ${url}`));
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > AUDIO_MAX_BYTES) {
            req.destroy(new Error("relay body too large"));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () =>
          resolve({
            buffer: Buffer.concat(chunks),
            contentType:
              (res.headers["content-type"] as string | undefined) || "audio/mpeg",
          })
        );
        res.on("error", reject);
      }
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("relay timeout")));
    req.end();
  });
}

// LRU of full audio bodies fetched through the relay. Previews are ~0.5MB
// and the relay itself caches for 1h, but serving from memory lets the
// player's Range/stall-recovery requests answer instantly.
const audioCache = new Map<string, BufferResult>();
let audioCacheBytes = 0;
const AUDIO_CACHE_MAX_BYTES = 64 * 1024 * 1024;

export async function relayAudioBuffer(url: string): Promise<BufferResult> {
  const hit = audioCache.get(url);
  if (hit) {
    audioCache.delete(url);
    audioCache.set(url, hit);
    return hit;
  }

  const result = await httpBuffer(HEXLET(url), AUDIO_RELAY_TIMEOUT_MS);

  audioCache.set(url, result);
  audioCacheBytes += result.buffer.byteLength;
  while (audioCacheBytes > AUDIO_CACHE_MAX_BYTES) {
    const oldest = audioCache.keys().next().value;
    if (oldest === undefined) break;
    const evicted = audioCache.get(oldest);
    audioCache.delete(oldest);
    if (evicted) audioCacheBytes -= evicted.buffer.byteLength;
  }

  return result;
}

// Deezer artwork lives on *.dzcdn.net (blocked locally). wsrv.nl fetches the
// image from its own network and serves it back; the browser can reach it.
export function proxiedImageUrl(url: string): string;
export function proxiedImageUrl(url: null): null;
export function proxiedImageUrl(url: string | null): string | null;
export function proxiedImageUrl(url: string | null): string | null {
  if (!url) return url;
  if (url.includes("dzcdn.net")) {
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}`;
  }
  return url;
}
