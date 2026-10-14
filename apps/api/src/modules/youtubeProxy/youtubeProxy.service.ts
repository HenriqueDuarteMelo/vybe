import https from "node:https";
import http from "node:http";
import { httpRequestText } from "../../utils/http.js";
import { relayAudioBuffer } from "../../utils/relay.js";

const INVIDIOUS_INSTANCES = [
  "https://invidious.nerdvpn.de",
  "https://yewtu.be",
  "https://inv.nadeko.net",
  "https://invidious.f5.si",
  "https://iv.melmac.space",
  "https://vid.puffyan.us",
  "https://invidious.privacyredirect.com",
  "https://yt.artemislena.eu",
];

const PIPED_INSTANCES = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.adminforge.de",
  "https://api.piped.projectsegfau.lt",
  "https://pipedapi.in.projectsegfau.lt",
  "https://pipedapi.leptons.xyz",
];

interface AudioStream {
  url: string;
  bitrate: number;
  mimeType: string;
  contentLength?: number;
}

interface ProxyResult {
  audioUrl: string;
  source: string;
  title?: string;
  duration?: number;
}

const AUDIO_MIME_TYPES = new Set([
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/aac",
]);

const MIME_EXT: Record<string, string> = {
  "audio/webm": ".webm",
  "audio/mp4": ".m4a",
  "audio/mpeg": ".mp3",
  "audio/ogg": ".ogg",
  "audio/aac": ".aac",
};

function pickBestAudio(streams: AudioStream[]): AudioStream | null {
  const audioOnly = streams.filter((s) => {
    const mime = s.mimeType.toLowerCase();
    return (
      AUDIO_MIME_TYPES.has(mime) ||
      mime.startsWith("audio/")
    );
  });
  if (audioOnly.length === 0) return null;

  audioOnly.sort((a, b) => b.bitrate - a.bitrate);

  const preferred = audioOnly.find(
    (s) => s.mimeType.includes("audio/webm") || s.mimeType.includes("audio/mp4")
  );
  return preferred || audioOnly[0];
}

function getExtFromMime(mimeType: string): string {
  for (const [mime, ext] of Object.entries(MIME_EXT)) {
    if (mimeType.includes(mime)) return ext;
  }
  return ".webm";
}

async function tryInvidious(videoId: string): Promise<ProxyResult | null> {
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const url = `${instance}/api/v1/videos/${videoId}?fields=title,lengthSeconds,adaptiveFormats`;
      const text = await httpRequestText(url, { timeoutMs: 10000 });
      const data = JSON.parse(text);

      if (!data.adaptiveFormats || !Array.isArray(data.adaptiveFormats)) continue;

      const streams: AudioStream[] = data.adaptiveFormats
        .filter((f: { type?: string; url?: string; bitrate?: number }) => {
          const mime = (f.type || "").toLowerCase();
          return mime.startsWith("audio/") && f.url;
        })
        .map((f: { type: string; url: string; bitrate: number; contentLength?: string }) => ({
          url: f.url,
          bitrate: f.bitrate || 0,
          mimeType: f.type || "audio/webm",
          contentLength: f.contentLength ? parseInt(f.contentLength, 10) : undefined,
        }));

      const best = pickBestAudio(streams);
      if (best) {
        return {
          audioUrl: best.url,
          source: `invidious:${instance}`,
          title: data.title,
          duration: data.lengthSeconds,
        };
      }
    } catch {
      continue;
    }
  }
  return null;
}

async function tryPiped(videoId: string): Promise<ProxyResult | null> {
  for (const instance of PIPED_INSTANCES) {
    try {
      const url = `${instance}/streams/${videoId}`;
      const text = await httpRequestText(url, { timeoutMs: 10000 });
      const data = JSON.parse(text);

      if (!data.audioStreams || !Array.isArray(data.audioStreams)) continue;

      const streams: AudioStream[] = data.audioStreams
        .filter((s: { url?: string; mimeType?: string; bitrate?: number }) => s.url && s.mimeType)
        .map((s: { url: string; mimeType: string; bitrate: number; contentLength?: string }) => ({
          url: s.url,
          bitrate: s.bitrate || 0,
          mimeType: s.mimeType,
          contentLength: s.contentLength ? parseInt(s.contentLength, 10) : undefined,
        }));

      const best = pickBestAudio(streams);
      if (best) {
        return {
          audioUrl: best.url,
          source: `piped:${instance}`,
          title: data.title,
          duration: data.duration,
        };
      }
    } catch {
      continue;
    }
  }
  return null;
}

async function tryYouTubeScrape(videoId: string): Promise<ProxyResult | null> {
  try {
    const url = `https://www.youtube.com/watch?v=${videoId}&hl=en&gl=US`;
    const text = await httpRequestText(url, { timeoutMs: 10000 });

    const match = text.match(/"adaptiveFormats":\s*(\[[\s\S]*?\])\s*,\s*"dashmanifest_url"/);
    if (!match) {
      const match2 = text.match(/"adaptiveFormats":\s*(\[[\s\S]*?\])\s*\}/);
      if (!match2) return null;
      var formats = JSON.parse(match2[1]);
    } else {
      var formats = JSON.parse(match[1]);
    }

    const audioFormats = formats
      .filter((f: { mimeType?: string; url?: string; signatureCipher?: string }) => {
        const mime = (f.mimeType || "").toLowerCase();
        return mime.startsWith("audio/") && f.url && !f.signatureCipher;
      })
      .map((f: { url: string; mimeType: string; bitrate: number; contentLength?: string }) => ({
        url: f.url,
        bitrate: f.bitrate || 0,
        mimeType: f.mimeType || "audio/webm",
        contentLength: f.contentLength ? parseInt(f.contentLength, 10) : undefined,
      }));

    const best = pickBestAudio(audioFormats);
    if (best) {
      const titleMatch = text.match(/"title":\s*"([^"]+)"/);
      return {
        audioUrl: best.url,
        source: "youtube-scrape",
        title: titleMatch ? titleMatch[1] : undefined,
      };
    }
  } catch {
    // fallback failed
  }
  return null;
}

function fetchUrlHeaders(url: string, timeoutMs = 8000): Promise<{ statusCode: number; headers: Record<string, string>; redirectUrl?: string } | null> {
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === "https:" ? https : http;

    const req = lib.request(
      url,
      { method: "HEAD", timeout: timeoutMs },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, url).toString();
          resolve({ statusCode: status, headers: res.headers as Record<string, string>, redirectUrl });
          res.resume();
          return;
        }
        resolve({ statusCode: status, headers: res.headers as Record<string, string> });
        res.resume();
      }
    );

    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
    req.end();
  });
}

let audioUrlCache = new Map<string, ProxyResult>();
let cacheTimestamps = new Map<string, number>();
const CACHE_TTL = 15 * 60 * 1000;

function getCached(videoId: string): ProxyResult | null {
  const ts = cacheTimestamps.get(videoId);
  if (ts && Date.now() - ts < CACHE_TTL) {
    return audioUrlCache.get(videoId) ?? null;
  }
  return null;
}

function setCache(videoId: string, result: ProxyResult) {
  audioUrlCache.set(videoId, result);
  cacheTimestamps.set(videoId, Date.now());
  if (audioUrlCache.size > 200) {
    const oldest = cacheTimestamps.keys().next().value;
    if (oldest) {
      audioUrlCache.delete(oldest);
      cacheTimestamps.delete(oldest);
    }
  }
}

export async function resolveAudioUrl(videoId: string): Promise<ProxyResult | null> {
  const cached = getCached(videoId);
  if (cached) return cached;

  const strategies = [
    tryInvidious,
    tryPiped,
    tryYouTubeScrape,
  ];

  const deadline = Date.now() + 25000;
  for (const strategy of strategies) {
    if (Date.now() > deadline) break;
    const result = await strategy(videoId);
    if (result && result.audioUrl) {
      setCache(videoId, result);
      return result;
    }
  }

  return null;
}

export function getExtensionForMime(mimeType: string): string {
  return getExtFromMime(mimeType);
}

export async function headProxyUrl(audioUrl: string): Promise<{ contentType: string; contentLength: number } | null> {
  const result = await fetchUrlHeaders(audioUrl);
  if (!result || result.statusCode < 200 || result.statusCode >= 400) return null;

  const contentType = result.headers["content-type"] || "audio/webm";
  const contentLength = parseInt(result.headers["content-length"] || "0", 10);

  return { contentType, contentLength };
}

interface ReplyLike {
  header: (k: string, v: string | number) => ReplyLike;
  status: (code: number) => ReplyLike;
  send: (body?: unknown) => unknown;
  raw?: { destroy: () => void };
}

// Serves a fully-downloaded body with proper Range support. The relay does
// not honor Range requests, so slicing locally keeps the player's seek and
// stall-recovery requests working exactly like a direct stream.
function serveBufferWithRange(
  buffer: Buffer,
  contentType: string,
  rangeHeader: string | undefined,
  reply: ReplyLike
) {
  reply
    .header("Content-Type", contentType)
    .header("Accept-Ranges", "bytes")
    .header("Access-Control-Allow-Origin", "*");

  const match = rangeHeader ? /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim()) : null;
  if (match && (match[1] || match[2])) {
    let start = match[1] ? parseInt(match[1], 10) : 0;
    let end = match[2] ? parseInt(match[2], 10) : buffer.length - 1;
    if (Number.isNaN(start) || start < 0 || start >= buffer.length) {
      reply.status(416).header("Content-Range", `bytes */${buffer.length}`).send();
      return;
    }
    if (Number.isNaN(end) || end >= buffer.length) end = buffer.length - 1;
    if (end < start) end = start;
    reply
      .status(206)
      .header("Content-Range", `bytes ${start}-${end}/${buffer.length}`)
      .header("Content-Length", end - start + 1)
      .send(buffer.subarray(start, end + 1));
    return;
  }

  reply.header("Content-Length", buffer.length).send(buffer);
}

export async function proxyAudioStream(
  audioUrl: string,
  rangeHeader: string | undefined,
  reply: ReplyLike
): Promise<void> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(audioUrl);
    const lib = parsed.protocol === "https:" ? https : http;

    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    };
    if (rangeHeader) {
      headers["Range"] = rangeHeader;
    }

    let sent = false;
    let finished = false;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;

    const clearIdleTimer = () => {
      if (idleTimer !== null) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
    };

    const abortDownstream = () => {
      try {
        reply.raw?.destroy?.();
      } catch {
        // best effort
      }
    };

    // Failures before the first byte goes out (blocked hosts reset the
    // connection, some respond 4xx/HTML) fall back to the public relay,
    // which fetches the audio from its own network and caches it here.
    let relayAttempted = false;
    const fallbackToRelay = (originalError: Error) => {
      clearIdleTimer();
      if (sent) {
        abortDownstream();
        reject(originalError);
        return;
      }
      if (relayAttempted) {
        reject(originalError);
        return;
      }
      relayAttempted = true;
      relayAudioBuffer(audioUrl).then(
        ({ buffer, contentType }) => {
          serveBufferWithRange(buffer, contentType, rangeHeader, reply);
          resolve();
        },
        () => reject(originalError)
      );
    };

    const req = lib.request(
      audioUrl,
      { method: "GET", headers, timeout: 30000 },
      (res) => {
        const status = res.statusCode ?? 0;

        if (status >= 300 && status < 400 && res.headers.location) {
          clearIdleTimer();
          res.resume();
          const nextUrl = new URL(res.headers.location, audioUrl).toString();
          proxyAudioStream(nextUrl, rangeHeader, reply).then(resolve).catch(reject);
          return;
        }

        if (status >= 400) {
          clearIdleTimer();
          res.resume();
          fallbackToRelay(new Error(`Upstream returned ${status}`));
          return;
        }

        const contentType = res.headers["content-type"] || "audio/webm";
        const contentLength = res.headers["content-length"];

        const replyWithStatus = rangeHeader && status === 206 ? reply.status(206) : reply;
        replyWithStatus
          .header("Content-Type", contentType)
          .header("Accept-Ranges", "bytes")
          .header("Access-Control-Allow-Origin", "*");

        if (contentLength) {
          replyWithStatus.header("Content-Length", parseInt(contentLength, 10));
        }

        const contentRange = res.headers["content-range"];
        if (contentRange) {
          replyWithStatus.header("Content-Range", contentRange);
        }

        // If the upstream goes silent mid-body, cut the response instead of
        // hanging forever so the browser can recover with a new Range request.
        res.on("error", () => {
          clearIdleTimer();
          if (sent) abortDownstream();
        });
        res.on("close", () => {
          clearIdleTimer();
          if (sent && !finished) abortDownstream();
        });
        const armIdle = () => {
          clearIdleTimer();
          idleTimer = setTimeout(() => {
            req.destroy();
            res.destroy();
            if (sent && !finished) abortDownstream();
          }, 20000);
        };
        res.on("data", armIdle);
        res.on("end", () => {
          finished = true;
          clearIdleTimer();
        });
        armIdle();

        replyWithStatus.send(res);
        sent = true;
        resolve();
      }
    );

    req.on("error", (err) => {
      clearIdleTimer();
      fallbackToRelay(err);
    });
    req.on("timeout", () => {
      if (finished) return;
      clearIdleTimer();
      req.destroy();
      fallbackToRelay(new Error("upstream timeout"));
    });
    req.end();
  });
}
