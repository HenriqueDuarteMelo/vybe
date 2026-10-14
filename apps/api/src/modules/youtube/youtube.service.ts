import { httpRequestText } from "../../utils/http.js";

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

export interface YtResult {
  videoId: string;
  title: string;
  channel: string;
  lengthSeconds: number;
}

interface ResolveResult {
  query: string;
  results: YtResult[];
}

function buildQuery(title: string, artist?: string): string {
  const parts: string[] = [];
  if (artist) parts.push(artist);
  parts.push(title);
  parts.push(artist ? "official audio" : "official video");
  return parts.join(" ");
}

async function requestText(url: string): Promise<string | null> {
  try {
    return await httpRequestText(url, { timeoutMs: 7000 });
  } catch {
    return null;
  }
}

async function searchInvidious(query: string): Promise<YtResult[]> {
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const url = `${instance}/api/v1/search?q=${encodeURIComponent(
        query
      )}&type=video&limit=10`;
      const text = await requestText(url);
      if (!text) continue;
      const items = JSON.parse(text);
      if (!Array.isArray(items)) continue;
      const results = items
        .filter(
          (it) =>
            it &&
            it.type === "video" &&
            typeof it.videoId === "string" &&
            !it.isLive &&
            !it.liveNow
        )
        .map((it) => ({
          videoId: it.videoId as string,
          title: String(it.title ?? ""),
          channel: String(it.author ?? ""),
          lengthSeconds: Number(it.lengthSeconds ?? 0),
        }))
        .filter((r) => r.lengthSeconds >= 25 && r.lengthSeconds <= 7200);
      if (results.length > 0) return results;
    } catch {
      continue;
    }
  }
  return [];
}

async function searchPiped(query: string): Promise<YtResult[]> {
  for (const instance of PIPED_INSTANCES) {
    try {
      const url = `${instance}/search?q=${encodeURIComponent(
        query
      )}&filter=videos`;
      const text = await requestText(url);
      if (!text) continue;
      const items = JSON.parse(text);
      const list = Array.isArray(items) ? items : items.items;
      if (!Array.isArray(list)) continue;
      const results = list
        .filter(
          (it) =>
            it &&
            it.url &&
            typeof it.url === "string" &&
            it.url.startsWith("/watch?v=") &&
            !it.isShort
        )
        .map((it) => {
          const match = it.url.match(/v=(.{11})/);
          return {
            videoId: match ? match[1] : "",
            title: String(it.title ?? ""),
            channel: String(it.uploaderName ?? it.uploader ?? ""),
            lengthSeconds: Number(it.duration ?? 0),
          };
        })
        .filter((r) => r.videoId && r.lengthSeconds >= 25 && r.lengthSeconds <= 7200);
      if (results.length > 0) return results;
    } catch {
      continue;
    }
  }
  return [];
}

function decodeEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\\u0026/g, "&");
}

function parseLength(text: string): number {
  const parts = text.trim().split(":");
  let seconds = 0;
  for (const part of parts) {
    const n = parseInt(part, 10);
    if (Number.isNaN(n)) return 0;
    seconds = seconds * 60 + n;
  }
  return seconds;
}

async function scrapeYouTube(query: string): Promise<YtResult[]> {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(
    query
  )}&hl=en&gl=US`;
  const text = await requestText(url);
  if (!text) return [];

  const results: YtResult[] = [];
  const seen = new Set<string>();
  const chunks = text.split('"videoRenderer":');

  for (let i = 1; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (!chunk.startsWith("{")) continue;
    const videoId = chunk.match(/"videoId":"([^"]+)"/)?.[1];
    if (!videoId || seen.has(videoId)) continue;
    seen.add(videoId);
    const title = decodeEntities(
      chunk.match(/"title":\{"runs":\[\{"text":"([^"]+)"\}/)?.[1] ?? ""
    );
    const lengthText =
      chunk.match(/"lengthText":\{"accessibility":\{(?:[^}]*)\},\{"simpleText":"([^"]*)"\}/)?.[1] ?? "";
    const lengthSeconds = parseLength(lengthText);
    results.push({ videoId, title, channel: "", lengthSeconds });
  }

  return results;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "");
}

function rankResults(results: YtResult[], title: string, artist?: string) {
  const targetTokens = new Set(
    normalize(artist ? `${artist} ${title}` : title)
      .split(/\s+/)
      .filter((t) => t.length > 2)
  );

  const stop = new Set(["official", "audio", "video", "music", "with", "lyrics", "lyric", "letra"]);

  const scored = results
    .map((r) => {
      const hay = normalize(`${r.title} ${r.channel}`);
      let score = 0;
      for (const token of targetTokens) {
        if (stop.has(token)) continue;
        if (hay.includes(token)) score += 1;
      }
      return { ...r, score };
    })
    .sort((a, b) => b.score - a.score);

  const max = scored[0]?.score ?? 0;
  return scored.filter((r) => r.score >= Math.max(1, Math.floor(max * 0.5)));
}

async function searchYoutubeAll(query: string): Promise<YtResult[]> {
  const [invidious, piped, scraped] = await Promise.all([
    searchInvidious(query),
    searchPiped(query),
    scrapeYouTube(query),
  ]);

  const seen = new Set<string>();
  const merged: YtResult[] = [];
  for (const r of [...invidious, ...piped, ...scraped]) {
    if (seen.has(r.videoId)) continue;
    seen.add(r.videoId);
    merged.push(r);
  }
  return merged;
}

export async function resolveYoutube(
  title: string,
  artist?: string
): Promise<ResolveResult> {
  const query = buildQuery(title, artist);
  const all = await searchYoutubeAll(query);
  const ranked = rankResults(all, title, artist);
  return { query, results: ranked.slice(0, 8) };
}