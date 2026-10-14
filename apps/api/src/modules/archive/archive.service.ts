import { httpRequestText } from "../../utils/http.js";
import { resolveArtistName } from "../musicbrainz/musicbrainz.service.js";

interface ArchiveItem {
  identifier: string;
  title: string;
  creator: string;
}

interface ArchiveFile {
  name: string;
  size: number;
  format: string;
  length?: string;
}

export interface ArchiveTrack {
  id: string;
  title: string;
  duration: number;
  audioUrl: string;
  trackNumber: number | null;
  albumId: string;
  artistId: string;
  artist: { id: string; name: string; imageUrl: null; bio: null };
  album: { id: string; title: string; coverUrl: null; releaseYear: null; artistId: string };
  genres: { id: string; name: string }[];
}

const GENRE = { id: "archive:collection", name: "Archive.org" };

interface CatalogEntry {
  artist: string;
  identifiers: string[];
}

const CATALOG: CatalogEntry[] = [
  { artist: "charlie brown jr", identifiers: ["1997-charlie-brown-jr-transpiracao-continua-prolongada", "09QuintaFeira", "LugarAoSol"] },
  { artist: "o rappa", identifiers: ["1999-o-rappa-ladob-ladoa", "1996-o-rappa-rappa-mundi"] },
  { artist: "skank", identifiers: ["skank-maquinarama-09-a-ultima-guerra"] },
  { artist: "capital inicial", identifiers: ["18-fogo_202502", "capital-inicial-03-a-sua-maneira"] },
  { artist: "legiao urbana", identifiers: ["1986-legiao-urbana-dois", "legiao-urbana1"] },
  { artist: "legião urbana", identifiers: ["1986-legiao-urbana-dois", "legiao-urbana1"] },
  { artist: "titas", identifiers: ["1986-titas-cabeca-dinossauro", "01.Clitoris"] },
  { artist: "titãs", identifiers: ["1986-titas-cabeca-dinossauro", "01.Clitoris"] },
  { artist: "paralamas", identifiers: ["1-alagados", "6-mensagem-de-amor", "os-paralamas-do-sucesso-9-luas"] },
  { artist: "racionais", identifiers: ["Racionais-NadaComoUmDiaApsOOutro2002", "RacionaisMCs-SobrevivendoNoInfernoRappratodos.blogspot.com.br"] },
  { artist: "faccao central", identifiers: ["FacoCentral-VersosSangrentos1999", "06DesculpaMe"] },
  { artist: "facção central", identifiers: ["FacoCentral-VersosSangrentos1999", "06DesculpaMe"] },
  { artist: "marilia mendonca", identifiers: ["01DeQuemEACulpa"] },
  { artist: "marília mendonça", identifiers: ["01DeQuemEACulpa"] },
  { artist: "felipe araujo", identifiers: ["felipearaujocomoeuteamotudodenovo64kbpsmp3juice.io"] },
  { artist: "felipe araújo", identifiers: ["felipearaujocomoeuteamotudodenovo64kbpsmp3juice.io"] },
  { artist: "raimundos", identifiers: ["Raimundos-2014CantigasDeRoda"] },
  { artist: "marcelo d2", identifiers: ["25-marcelo-d-2-mantenha-o-respeito-ii-live", "MarceloD2-AcsticoMTV2004Rappratodos.blogspot.com.br"] },
  { artist: "sorriso maroto", identifiers: ["y-2mate.com-sorriso-maroto-volta-pra-casa-como-antigamente"] },
  { artist: "luan santana", identifiers: ["LuanSantana-TeVivo"] },
  { artist: "mc kevinho", identifiers: ["mckevinhooficial-olha-a-explosao-videoclipe-kondzilla-2ecc3bab"] },
];

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function flatten(s: string): string {
  return normalize(s).replace(/[^a-z0-9]+/g, "");
}

/**
 * How well an Archive item matches the query keys (raw term and/or the
 * MusicBrainz-resolved artist name). Returns -1 when it does not match at all,
 * so items that only matched via a loose description search get dropped.
 */
function itemRelevance(item: ArchiveItem, keys: string[]): number {
  const haystack = flatten(`${item.title ?? ""} ${item.creator ?? ""}`);
  if (!haystack) return -1;

  let best = -1;
  for (const key of keys) {
    const flat = flatten(key);
    if (!flat) continue;
    if (haystack.includes(flat)) {
      best = Math.max(best, 2);
      continue;
    }
    const tokens = normalize(key)
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 2);
    if (tokens.length > 0 && tokens.every((token) => haystack.includes(token))) {
      best = Math.max(best, 1);
    }
  }
  return best;
}

function rankItems(
  itemsById: Map<string, ArchiveItem>,
  keys: string[]
): ArchiveItem[] {
  return [...itemsById.values()]
    .map((item) => ({ item, relevance: itemRelevance(item, keys) }))
    .filter((entry) => entry.relevance >= 0)
    .sort((a, b) => b.relevance - a.relevance)
    .map((entry) => entry.item);
}

const ABBREV: Record<string, string> = { junior: "jr", jr: "jr", mc: "mc" };

function tokenMatches(termToken: string, artistNorm: string): boolean {
  if (artistNorm.includes(termToken)) return true;
  const abbrev = ABBREV[termToken];
  if (abbrev && artistNorm.includes(abbrev)) return true;
  return false;
}

function matchArtist(term: string): string[] {
  const t = normalize(term);
  if (!t) return [];
  const tokens = t.split(/\s+/).filter((w) => w.length > 2);
  const matches: string[] = [];
  for (const entry of CATALOG) {
    const artistNorm = normalize(entry.artist);
    let score = 0;
    if (artistNorm === t) score = 3;
    else if (artistNorm.startsWith(t) || t.startsWith(artistNorm)) score = 2;
    else if (tokens.length > 0 && tokens.every((tok) => tokenMatches(tok, artistNorm))) score = 1;
    if (score > 0) matches.push(entry.artist);
  }
  return matches;
}

async function tracksFromCatalogArtist(artist: string): Promise<ArchiveTrack[]> {
  const entry = CATALOG.find((e) => e.artist === artist);
  if (!entry) return [];
  const results: ArchiveTrack[] = [];
  const seen = new Set<string>();
  for (const identifier of entry.identifiers) {
    try {
      const tracks = await getArchiveItemTracks(identifier);
      for (const t of tracks) {
        if (seen.has(t.id)) continue;
        seen.add(t.id);
        results.push(t);
      }
    } catch {
      // skip
    }
  }
  return results;
}

function parseDuration(length?: string): number {
  if (!length) return 0;
  const parts = length.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return Math.round(Number(parts[0]) || 0);
}

function buildTrack(item: ArchiveItem, file: ArchiveFile, index: number): ArchiveTrack {
  const cleanName = file.name.replace(/\.mp3$/i, "").replace(/^\d+\s*[-.)\s]+\s*/i, "");
  const artistName = item.creator || "Unknown Artist";
  const artistId = `archive:artist:${artistName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const albumId = `archive:album:${item.identifier}`;

  return {
    id: `archive:${item.identifier}:${encodeURIComponent(file.name)}`,
    title: cleanName,
    duration: parseDuration(file.length),
    audioUrl: `https://archive.org/download/${item.identifier}/${encodeURIComponent(file.name)}`,
    trackNumber: index + 1,
    albumId,
    artistId,
    artist: { id: artistId, name: artistName, imageUrl: null, bio: null },
    album: { id: albumId, title: item.title || item.identifier, coverUrl: null, releaseYear: null, artistId },
    genres: [GENRE],
  };
}

interface ArchiveSearchResult {
  tracks: ArchiveTrack[];
  artistMatched: boolean;
}

const cache = new Map<string, ArchiveTrack[] | ArchiveSearchResult>();
const CACHE_TTL = 10 * 60 * 1000;
const cacheTimestamps = new Map<string, number>();

function getCached(key: string): ArchiveTrack[] | ArchiveSearchResult | null {
  const ts = cacheTimestamps.get(key);
  if (ts && Date.now() - ts < CACHE_TTL) {
    const cached = cache.get(key);
    if (cached) return cached;
  }
  return null;
}

function setCache(key: string, value: ArchiveTrack[] | ArchiveSearchResult) {
  cache.set(key, value);
  cacheTimestamps.set(key, Date.now());
  if (cache.size > 200) {
    const oldest = cacheTimestamps.keys().next().value;
    if (oldest) {
      cache.delete(oldest);
      cacheTimestamps.delete(oldest);
    }
  }
}

async function searchArchiveItems(term: string): Promise<ArchiveItem[]> {
  const escaped = term.replace(/["\\]/g, " ").trim();
  if (!escaped) return [];
  const query = `(creator:"${escaped}" OR title:"${escaped}") AND mediatype:audio`;
  const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(
    query
  )}&fl[]=identifier&fl[]=title&fl[]=creator&rows=15&output=json&sort[]=downloads+desc`;
  const resp = await httpRequestText(url, { timeoutMs: 12000 });
  const data = JSON.parse(resp);
  return (data.response?.docs || []) as ArchiveItem[];
}

// Strict search: items CREATED by the artist. This is what surfaces real
// albums/songs for an artist search ("eminem", "cbjr", "tpain") and, unlike
// the generic title/creator search, never matches podcasts or news shows that
// merely talk about the artist.
async function searchItemsByCreator(creator: string): Promise<ArchiveItem[]> {
  const escaped = creator.replace(/["\\]/g, " ").trim();
  if (!escaped) return [];
  const query = `creator:"${escaped}" AND mediatype:audio`;
  const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(
    query
  )}&fl[]=identifier&fl[]=title&fl[]=creator&rows=15&output=json&sort[]=downloads+desc`;
  const resp = await httpRequestText(url, { timeoutMs: 12000 });
  const data = JSON.parse(resp);
  return (data.response?.docs || []) as ArchiveItem[];
}

// An item only counts as an artist's own release when its creator field
// actually contains the artist name (raw term and/or MusicBrainz-canonical
// name). -1 drops it: a "show" whose creator is not the artist is not music
// by that artist.
function creatorRelevance(item: ArchiveItem, keys: string[]): number {
  const creator = flatten(item.creator ?? "");
  if (!creator) return -1;
  for (const key of keys) {
    const flat = flatten(key);
    if (flat && creator.includes(flat)) return 2;
  }
  return -1;
}

// Memoized: search merge and full-audio lookups hit the same compilation
// items over and over (one item holds a whole album), and each metadata call
// is a network round-trip.
const audioFilesCache = new Map<string, { files: ArchiveFile[]; at: number }>();
const AUDIO_FILES_TTL = 15 * 60 * 1000;

async function getAudioFiles(identifier: string): Promise<ArchiveFile[]> {
  const hit = audioFilesCache.get(identifier);
  if (hit && Date.now() - hit.at < AUDIO_FILES_TTL) return hit.files;

  const url = `https://archive.org/metadata/${identifier}/files`;
  const resp = await httpRequestText(url, { timeoutMs: 12000 });
  const parsed = JSON.parse(resp) as { result?: ArchiveFile[] };
  const raw = Array.isArray(parsed) ? parsed : (parsed.result ?? []);
  const files = raw.filter(
    (f) =>
      (f.name?.toLowerCase().endsWith(".mp3") || f.name?.toLowerCase().endsWith(".ogg")) &&
      Number(f.size || 0) > 50000
  );
  audioFilesCache.set(identifier, { files, at: Date.now() });
  if (audioFilesCache.size > 200) {
    const oldest = audioFilesCache.keys().next().value;
    if (oldest) audioFilesCache.delete(oldest);
  }
  return files;
}

const MIN_TRACK_SECONDS = 60;

const BAD_KEYWORDS = [
  "instrumental",
  "karaoke",
  "playback",
  "backing track",
  "backing-track",
  "type beat",
  "ringtone",
  "snippet",
  "preview",
  "teaser",
];

function isBadName(name: string): boolean {
  const n = normalize(name);
  return BAD_KEYWORDS.some((keyword) => n.includes(keyword));
}

// Container-level junk: podcast/news/commentary/tribute items are NOT the
// music a user searches for, even when their title/creator mentions the
// query artist.
const ITEM_JUNK_KEYWORDS = [
  "podcast",
  "episod",
  "prediction",
  "interview",
  "talk show",
  "talkshow",
  "radio show",
  "tribute",
  "the songs of",
  "karaoke",
  "lip-sync",
];

// Whole-word only: "cover" as a substring would also kill albums like
// "Discovery" (d-is-cover-y), which is exactly the music we want.
const ITEM_JUNK_WORDS = ["cover"];

function isJunkItem(item: ArchiveItem): boolean {
  const hay = normalize(`${item.title ?? ""} ${item.creator ?? ""}`);
  if (ITEM_JUNK_KEYWORDS.some((keyword) => hay.includes(keyword))) return true;
  return ITEM_JUNK_WORDS.some((word) =>
    new RegExp(`(^|[^a-z0-9])${word}([^a-z0-9]|$)`).test(hay)
  );
}

function isLongEnough(file: ArchiveFile): boolean {
  const duration = parseDuration(file.length);
  return duration === 0 || duration >= MIN_TRACK_SECONDS;
}

// Collapses quality/duplicate markers so "song", "song_64kb" and "song (1)"
// are treated as the same file.
function canonicalFileName(name: string): string {
  let base = normalize(name).replace(/\.(mp3|ogg)$/i, "");
  base = base.replace(/[_\-\s]*(64|96|128|160|192|256|320)\s?k(bps|b)?\b/g, "");
  base = base.replace(/[_\-\s]*vbr\b/g, "");
  base = base.replace(/[_\-\s]*\(\d+\)\s*$/g, "");
  return base.replace(/\s+/g, " ").trim();
}

function dedupeAudioFiles(files: ArchiveFile[]): ArchiveFile[] {
  const seen = new Map<string, ArchiveFile>();
  for (const file of files) {
    const key = canonicalFileName(file.name || "");
    const existing = seen.get(key);
    if (!existing || Number(file.size || 0) > Number(existing.size || 0)) {
      seen.set(key, file);
    }
  }
  return [...seen.values()];
}

function selectAudioFiles(files: ArchiveFile[], limit: number): ArchiveFile[] {
  const filtered = files.filter(
    (file) => !isBadName(file.name || "") && isLongEnough(file)
  );
  return dedupeAudioFiles(filtered).slice(0, limit);
}

function dedupeTracks(tracks: ArchiveTrack[]): ArchiveTrack[] {
  const seen = new Set<string>();
  const out: ArchiveTrack[] = [];
  for (const track of tracks) {
    const key = flatten(canonicalFileName(track.title || ""));
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(track);
  }
  return out;
}

export async function searchArchive(term: string): Promise<ArchiveSearchResult> {
  const t = term.trim().toLowerCase();
  if (!t) return { tracks: [], artistMatched: false };

  const cached = getCached(t);
  if (cached) return cached as ArchiveSearchResult;

  try {
    const results: ArchiveTrack[] = [];
    const seen = new Set<string>();
    let artistMatched = false;

    const matchedArtists = matchArtist(term);
    if (matchedArtists.length > 0) artistMatched = true;
    for (const artist of matchedArtists) {
      const artistTracks = await tracksFromCatalogArtist(artist);
      for (const tr of artistTracks) {
        if (seen.has(tr.id)) continue;
        seen.add(tr.id);
        results.push(tr);
      }
    }

    // Artist-first search: look for items created BY the query artist (raw term
    // and/or the canonical name MusicBrainz resolved, e.g. "cbjr" -> "Charlie
    // Brown Jr."). When that hits, item creator == artist, so podcasts/news
    // that merely mention the artist never make it through.
    const resolved = await resolveArtistName(term).catch(() => null);
    const keys = Array.from(
      new Set([term, resolved].filter((k): k is string => Boolean(k)))
    );

    const creatorItems = (
      await Promise.all(
        keys.map((key) => searchItemsByCreator(key).catch(() => [] as ArchiveItem[]))
      )
    ).flat();

    const itemsById = new Map<string, ArchiveItem>();
    for (const item of creatorItems) {
      if (
        item.identifier &&
        !isJunkItem(item) &&
        creatorRelevance(item, keys) >= 0
      ) {
        itemsById.set(item.identifier, item);
      }
    }

    const artistItems = [...itemsById.values()].slice(0, 10);
    if (artistItems.length > 0) {
      artistMatched = true;
      const fetches = artistItems.map(async (item) => {
        try {
          const files = selectAudioFiles(await getAudioFiles(item.identifier), 20);
          for (const file of files) {
            const key = `${item.identifier}:${file.name}`;
            if (seen.has(key)) continue;
            seen.add(key);
            results.push(buildTrack(item, file, results.length));
          }
        } catch {
          // skip items that fail
        }
      });
      await Promise.allSettled(fetches);
    }

    // Generic fallback only for queries that are NOT an artist (e.g. a song
    // title): a plain title/creator search that can still surface podcasts.
    // Junk items are filtered out before ranking.
    if (!artistMatched) {
      const rawItems = await searchArchiveItems(term).catch(() => [] as ArchiveItem[]);
      const genericById = new Map<string, ArchiveItem>();
      for (const item of rawItems) {
        if (item.identifier && !isJunkItem(item)) {
          genericById.set(item.identifier, item);
        }
      }

      let items = rankItems(genericById, keys);

      if (items.length < 3 && resolved) {
        const more = await searchArchiveItems(resolved).catch(() => [] as ArchiveItem[]);
        for (const item of more) {
          if (
            item.identifier &&
            !isJunkItem(item) &&
            !genericById.has(item.identifier)
          ) {
            genericById.set(item.identifier, item);
          }
        }
        items = rankItems(genericById, keys);
      }

      const fetches = items.slice(0, 10).map(async (item) => {
        try {
          const files = selectAudioFiles(await getAudioFiles(item.identifier), 20);
          for (const file of files) {
            const key = `${item.identifier}:${file.name}`;
            if (seen.has(key)) continue;
            seen.add(key);
            results.push(buildTrack(item, file, results.length));
          }
        } catch {
          // skip items that fail
        }
      });
      await Promise.allSettled(fetches);
    }

    const result: ArchiveSearchResult = { tracks: dedupeTracks(results), artistMatched };
    if (result.tracks.length > 0) setCache(t, result);
    return result;
  } catch (error) {
    console.log("[archive] search failed:", error instanceof Error ? error.message : error);
    return { tracks: [], artistMatched: false };
  }
}

export async function getArchiveItemTracks(identifier: string): Promise<ArchiveTrack[]> {
  const cacheKey = `item:${identifier}`;
  const cached = getCached(cacheKey);
  if (cached) return Array.isArray(cached) ? cached : [];

  try {
    const metaResp = await httpRequestText(
      `https://archive.org/metadata/${identifier}`,
      { timeoutMs: 12000 }
    );
    const meta = JSON.parse(metaResp);

    const item: ArchiveItem = {
      identifier,
      title: meta.metadata?.title || identifier,
      creator: meta.metadata?.creator || "Unknown Artist",
    };

    const rawFiles = ((meta.files || []) as ArchiveFile[]).filter(
      (f) =>
        (f.name?.toLowerCase().endsWith(".mp3") || f.name?.toLowerCase().endsWith(".ogg")) &&
        Number(f.size || 0) > 50000
    );
    const files = selectAudioFiles(rawFiles, 100);

    const tracks = files.map((f: ArchiveFile, i: number) => buildTrack(item, f, i));
    setCache(cacheKey, tracks);
    return tracks;
  } catch (error) {
    console.log("[archive] getItemTracks failed:", error instanceof Error ? error.message : error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Full-audio lookup for search enrichment.
//
// Searches ONE specific song (title + artist) on archive.org so search results
// can stream the whole track instead of a 30-second Deezer preview. Matching
// is file-name based: real uploads often sit inside compilation items whose
// title/creator never mention the song ("Hit Container '97" holding
// "06-skank-garota-nacional.mp3"), while item-level creator/title only works
// for single-track items.
//
// A candidate is only accepted through versionsMatch(): both titles must
// reduce to the same core (no album numbers, artist names, CD/track prefixes
// or edition labels), carry the same version markers (live/acoustic/remix/
// demo) and sit within 10%/20s duration of each other, plus the artist must
// appear on one side or the other. That is what keeps "2 + 2 = 5 (Live)"
// from stealing the audio URL of "You (Live)".
// ---------------------------------------------------------------------------

// ---- Version-aware matching ---------------------------------------------

function normWords(value: string | null | undefined): string[] {
  return normalize(value ?? "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

const VERSION_DROP = new Set([
  "version",
  "versions",
  "album",
  "single",
  "edit",
  "extended",
  "remaster",
  "remastered",
  "remastering",
  "remasterizado",
  "mono",
  "stereo",
  "official",
  "audio",
]);

function isVersionNoise(word: string): boolean {
  return (
    VERSION_DROP.has(word) || /^(?:cd|disc|tape|track|dvd|mp3|side)\d*$/.test(word)
  );
}

function versionFlags(title: string, artistTokens: Set<string>): string[] {
  const words = new Set(
    normWords(title).filter((word) => !artistTokens.has(word))
  );
  const flags: string[] = [];
  if (words.has("live") || words.has("vivo")) flags.push("live");
  if (words.has("acoustic") || words.has("acustico")) flags.push("acoustic");
  if (words.has("remix")) flags.push("remix");
  if (words.has("demo")) flags.push("demo");
  return flags;
}

function coreKey(title: string, artistTokens: Set<string>): string {
  const words = normWords(title);
  let out = words.filter(
    (word) =>
      !/^\d+$/.test(word) && !artistTokens.has(word) && !isVersionNoise(word)
  );
  if (out.length === 0) out = words.filter((word) => !artistTokens.has(word));
  if (out.length === 0) out = words;
  return out.join("");
}

interface MatchSide {
  title?: string | null;
  artist?: { name?: string | null } | null;
  duration?: number | null;
  context?: string | null;
}

export function versionsMatch(track: MatchSide, candidate: MatchSide): boolean {
  const trackArtist = (track.artist?.name ?? "").trim();
  const candArtist = (candidate.artist?.name ?? "").trim();
  const artistTokens = new Set(
    [...normWords(trackArtist), ...normWords(candArtist)]
  );

  const coreTrack = coreKey(track.title ?? "", artistTokens);
  const coreCand = coreKey(candidate.title ?? "", artistTokens);
  if (coreTrack.length < 3 || coreTrack !== coreCand) return false;

  const flagsTrack = versionFlags(track.title ?? "", artistTokens);
  const flagsCand = versionFlags(candidate.title ?? "", artistTokens);
  if (flagsTrack.length !== flagsCand.length) return false;
  if (!flagsTrack.every((flag) => flagsCand.includes(flag))) return false;

  const dTrack = Number(track.duration || 0);
  const dCand = Number(candidate.duration || 0);
  if (dTrack > 0 && dCand > 0) {
    const drift = Math.abs(dTrack - dCand);
    if (drift > Math.max(20, Math.round(dTrack * 0.1))) return false;
  }

  // The artist may live in the file name, the item creator or (phase 2) the
  // item title; "Unknown Artist" never counts as evidence.
  const flatTrackArtist = flatten(trackArtist);
  const flatCandArtist = flatten(candArtist);
  const hayTrack = `${flatten(track.title ?? "")}${flatTrackArtist}`;
  const hayCand = `${flatten(candidate.title ?? "")}${flatCandArtist}${flatten(
    candidate.context ?? ""
  )}`;
  const trackKnown = flatTrackArtist.length >= 2;
  const candKnown =
    flatCandArtist.length >= 2 && flatCandArtist !== "unknownartist";
  if (trackKnown || candKnown) {
    const trackInCand = trackKnown && hayCand.includes(flatTrackArtist);
    const candInTrack = candKnown && hayTrack.includes(flatCandArtist);
    if (!trackInCand && !candInTrack) return false;
  }
  return true;
}

// Identity used to collapse duplicate rows (deezer + archive serving the
// same song) down to one line in the results list.
export function trackVersionKey(
  title: string | null | undefined,
  artist: string | null | undefined
): string | null {
  const artistTokens = new Set(normWords(artist));
  const core = coreKey(title ?? "", artistTokens);
  if (core.length < 3) return null;
  return `${core}|${versionFlags(title ?? "", artistTokens).join(",")}|${flatten(
    artist ?? ""
  )}`;
}

async function archiveSearch(query: string, rows: number): Promise<ArchiveItem[]> {
  const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(
    query
  )}&fl[]=identifier&fl[]=title&fl[]=creator&rows=${rows}&output=json&sort[]=downloads+desc`;
  const resp = await httpRequestText(url, { timeoutMs: 6000 });
  const data = JSON.parse(resp);
  return (data.response?.docs || []) as ArchiveItem[];
}

function pickFullAudioFile(
  item: ArchiveItem,
  files: ArchiveFile[],
  track: { title: string; artist: string; duration: number }
): ArchiveFile | null {
  const longEnough = files.filter((file) => {
    const duration = parseDuration(file.length);
    return duration === 0 || duration >= MIN_TRACK_SECONDS;
  });
  if (longEnough.length === 0) return null;

  const trackSide: MatchSide = {
    title: track.title,
    artist: { name: track.artist },
    duration: track.duration,
  };

  // Strongest: the file name itself carries the song (and usually the artist).
  for (const file of longEnough) {
    const candidate: MatchSide = {
      title: file.name,
      artist: { name: item.creator ?? "" },
      duration: parseDuration(file.length),
      context: item.title ?? "",
    };
    if (versionsMatch(trackSide, candidate)) return file;
  }

  // Single-track items: the item title identifies the song even when the
  // file inside is called "tape.mp3".
  if (longEnough.length === 1) {
    const file = longEnough[0];
    const candidate: MatchSide = {
      title: item.title ?? "",
      artist: { name: item.creator ?? "" },
      duration: parseDuration(file.length),
      context: file.name,
    };
    if (versionsMatch(trackSide, candidate)) return file;
  }

  return null;
}

const fullAudioCache = new Map<string, ArchiveTrack | null>();
const fullAudioTimestamps = new Map<string, number>();
const fullAudioPending = new Map<string, Promise<ArchiveTrack | null>>();
const FULL_AUDIO_TTL = 30 * 60 * 1000;

export function findFullAudio(
  title: string,
  artist: string | null,
  duration?: number | null
): Promise<ArchiveTrack | null> {
  const cleanTitle = title.replace(/["\\]/g, " ").trim();
  const cleanArtist = (artist ?? "").replace(/["\\]/g, " ").trim();
  const flatTitle = flatten(cleanTitle);
  const flatArtist = flatten(cleanArtist);
  if (flatTitle.length < 3) return Promise.resolve(null);

  const trackSide: MatchSide = {
    title: cleanTitle,
    artist: { name: cleanArtist },
    duration: Number(duration || 0),
  };
  // A cached hit was validated against whatever duration the first requester
  // had, so it is re-checked against THIS track before being handed back.
  const accept = (found: ArchiveTrack | null): ArchiveTrack | null => {
    if (!found) return null;
    return versionsMatch(trackSide, {
      title: found.title,
      artist: found.artist,
      duration: found.duration,
      context: found.album?.title,
    })
      ? found
      : null;
  };

  const cacheKey = `${flatTitle}|${flatArtist}`;
  const cachedAt = fullAudioTimestamps.get(cacheKey);
  if (
    cachedAt &&
    Date.now() - cachedAt < FULL_AUDIO_TTL &&
    fullAudioCache.has(cacheKey)
  ) {
    return Promise.resolve(accept(fullAudioCache.get(cacheKey) ?? null));
  }

  // Dedup in-flight lookups so two tracks (or two rapid searches) waiting on
  // the same song share one round-trip instead of stampeding the archive.
  const inflight = fullAudioPending.get(cacheKey);
  if (inflight) return inflight;

  const lookup = runFullAudioLookup(
    cleanTitle,
    cleanArtist,
    Number(duration || 0)
  )
    .catch((error) => {
      console.log(
        "[archive] findFullAudio failed:",
        error instanceof Error ? error.message : error
      );
      return null as ArchiveTrack | null;
    })
    .then((found) => {
      fullAudioCache.set(cacheKey, found);
      fullAudioTimestamps.set(cacheKey, Date.now());
      if (fullAudioCache.size > 300) {
        const oldest = fullAudioTimestamps.keys().next().value;
        if (oldest) {
          fullAudioCache.delete(oldest);
          fullAudioTimestamps.delete(oldest);
        }
      }
      return accept(found);
    })
    .finally(() => {
      fullAudioPending.delete(cacheKey);
    });

  fullAudioPending.set(cacheKey, lookup);
  return lookup;
}

async function runFullAudioLookup(
  cleanTitle: string,
  cleanArtist: string,
  duration: number
): Promise<ArchiveTrack | null> {
  // strict -> fulltext -> title-only; fetched in parallel (validation below
  // still walks them in that priority order) so a miss costs one round-trip
  // instead of three stacked ones.
  const queries: string[] = [];
  if (cleanArtist) {
    queries.push(
      `title:"${cleanTitle}" AND creator:"${cleanArtist}" AND mediatype:audio`
    );
    queries.push(`"${cleanTitle}" AND "${cleanArtist}" AND mediatype:audio`);
  }
  queries.push(`title:"${cleanTitle}" AND mediatype:audio`);

  const itemLists = await Promise.all(
    queries.map((query) => archiveSearch(query, 3).catch(() => [] as ArchiveItem[]))
  );

  for (const items of itemLists) {
    for (const item of items) {
      if (isJunkItem(item)) continue;
      try {
        const files = selectAudioFiles(await getAudioFiles(item.identifier), 40);
        const file = pickFullAudioFile(item, files, {
          title: cleanTitle,
          artist: cleanArtist,
          duration,
        });
        if (file) return buildTrack(item, file, 0);
      } catch {
        // skip items whose metadata fails
      }
    }
  }
  return null;
}
