import { httpRequestText } from "../../utils/http.js";

const MB_BASE = "https://musicbrainz.org/ws/2";
const USER_AGENT = "VYBE/0.1.0 (https://github.com/vybe-app)";
const CACHE_TTL = 60 * 60 * 1000;
const NULL_CACHE_TTL = 2 * 60 * 1000;
const MIN_SCORE = 80;
const MAX_ATTEMPTS = 2;

const cache = new Map<string, { name: string | null; at: number }>();
let lastRequestAt = 0;

async function throttle(): Promise<void> {
  const wait = Math.max(0, 1000 - (Date.now() - lastRequestAt));
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequestAt = Date.now();
}

function normalizeName(name: string): string {
  return name.replace(/[\u2010-\u2015]/g, "-").trim();
}

/**
 * Resolves a free-text query (including abbreviations/nicknames like "tpain")
 * to the most likely canonical artist name, dynamically. Best effort: returns
 * `null` when nothing confident is found or MusicBrainz is unavailable.
 */
export async function resolveArtistName(term: string): Promise<string | null> {
  const key = term.trim().toLowerCase();
  if (!key) return null;

  const cached = cache.get(key);
  if (cached) {
    const age = Date.now() - cached.at;
    const fresh = cached.name ? age < CACHE_TTL : age < NULL_CACHE_TTL;
    if (fresh) return cached.name;
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await throttle();
      const url = `${MB_BASE}/artist?query=${encodeURIComponent(
        term
      )}&fmt=json&limit=5`;
      const text = await httpRequestText(url, {
        timeoutMs: 9000,
        headers: { "User-Agent": USER_AGENT },
      });
      const data = JSON.parse(text) as {
        artists?: { name: string; score: number }[];
      };
      const best = data.artists?.[0];
      if (best && best.score >= MIN_SCORE) {
        const name = normalizeName(best.name);
        cache.set(key, { name, at: Date.now() });
        return name;
      }
      // MB replied but found no confident artist: remember briefly so we do
      // not hammer it again, but short enough that a later call can re-check.
      cache.set(key, { name: null, at: Date.now() });
      return null;
    } catch (error) {
      if (attempt < MAX_ATTEMPTS) {
        // transient network/ratelimit hiccup: back off and retry once
        await new Promise((resolve) => setTimeout(resolve, 1500));
        continue;
      }
      console.log(
        "[musicbrainz] resolve failed for term:",
        key,
        error instanceof Error ? error.message : error
      );
      cache.set(key, { name: null, at: Date.now() });
      return null;
    }
  }

  cache.set(key, { name: null, at: Date.now() });
  return null;
}
