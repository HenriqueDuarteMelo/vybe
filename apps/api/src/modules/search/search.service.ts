import { prisma } from "../../utils/prisma.js";
import { searchDeezer, getDeezerArtistTopTracks } from "../discover/discover.service.js";
import { searchRemote } from "../remote/remote.service.js";
import { searchArchive } from "../archive/archive.service.js";
import {
  attachFullAudio,
  collapseDuplicates,
  isFullAudio,
} from "../enrichment/enrichment.service.js";
import { resolveArtistName } from "../musicbrainz/musicbrainz.service.js";

interface SearchQuery {
  q: string;
  page?: number;
  limit?: number;
  type?: "track" | "artist" | "album" | "genre" | "all";
}

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// 0 = exact, 1 = prefix, 2 = contains, 99 = no match.
function scoreMatch(term: string, value: string): number {
  const t = normalize(term);
  const v = normalize(value);
  if (!t) return 99;
  if (v === t) return 0;
  if (v.startsWith(t)) return 1;
  if (v.includes(t)) return 2;
  return 99;
}

interface TrackLike {
  title?: string;
  artist?: { name?: string | null } | null;
  album?: { title?: string | null } | null;
  genres?: { name?: string | null }[] | null;
}

// Lower is better. Artist matches rank first (searching a singer's name should
// surface their own songs), then title, then album/genre. The artist field is
// scored against both the raw term and the MusicBrainz-resolved name, so a
// query like "cbjr" still matches tracks whose artist is "Charlie Brown Jr.".
// Returns null when the track does not match the term in any field so
// irrelevant external results (SoundHelix, archive compilations, covers) get
// dropped.
function scoreTrack(term: string, track: TrackLike, resolvedArtist?: string | null): number | null {
  if (!normalize(term)) return 0;
  const keys = resolvedArtist ? [term, resolvedArtist] : [term];
  let artist = 99;
  for (const key of keys) {
    artist = Math.min(artist, track.artist?.name ? scoreMatch(key, track.artist.name) : 99);
  }
  const title = track.title ? scoreMatch(term, track.title) : 99;
  const album = track.album?.title ? scoreMatch(term, track.album.title) : 99;
  let genre = 99;
  if (Array.isArray(track.genres)) {
    for (const g of track.genres) {
      if (g?.name) genre = Math.min(genre, scoreMatch(term, g.name));
    }
  }
  if (artist < 99) return artist;
  if (title < 99) return 3 + title;
  // "artist + title" in one query ("skank garota nacional"): no single field
  // contains the whole term, but every word of the term is accounted for
  // across artist and title together. Ranks below a direct title match.
  const termTokens = normalize(term).split(" ").filter((token) => token.length > 1);
  if (termTokens.length > 1) {
    const words = new Set(
      `${normalize(track.artist?.name)} ${normalize(track.title)}`.split(" ")
    );
    if (termTokens.every((token) => words.has(token))) return 4;
  }
  if (album < 99) return 6 + album;
  if (genre < 99) return 9 + genre;
  return null;
}

function sortByRelevance<T>(
  items: T[],
  term: string,
  getValue: (item: T) => string,
  tieBreak?: (a: T, b: T) => number
): T[] {
  return [...items].sort((a, b) => {
    const sa = scoreMatch(term, getValue(a));
    const sb = scoreMatch(term, getValue(b));
    if (sa !== sb) return sa - sb;
    if (tieBreak) {
      const tb = tieBreak(a, b);
      if (tb !== 0) return tb;
    }
    return getValue(a).localeCompare(getValue(b));
  });
}

const TOP_PRIORITY: Record<string, number> = {
  artist: 0,
  track: 1,
  album: 2,
  genre: 3,
};

async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.log(
      "[search] local DB unavailable, using streaming results only:",
      error instanceof Error ? error.message.split("\n")[0] : error
    );
    return fallback;
  }
}

export async function search(query: SearchQuery) {
  const term = query.q.trim();
  if (!term) {
    return { top: null, tracks: [], artists: [], albums: [], genres: [] };
  }

  const limit = Math.min(50, Math.max(1, query.limit || 20));
  const type = query.type || "all";

  const wantTrack = type === "all" || type === "track";
  const wantArtist = type === "all" || type === "artist";
  const wantAlbum = type === "all" || type === "album";
  const wantGenre = type === "all" || type === "genre";

  const results: Record<string, any> = {};

  // Deezer lookup and MusicBrainz name resolution are independent — run them
  // together so the relay round-trip doesn't stack on top of the MB throttle.
  const [deezer, resolvedArtist] = await Promise.all([
    searchDeezer(term).catch(() => ({
      tracks: [],
      artists: [],
      albums: [],
    })),
    // Resolve canonical artist name so short/nick queries ("cbjr", "tpain")
    // keep matching the artist's actual name when scoring tracks.
    resolveArtistName(term).catch(() => null),
  ]);

  // When the query clearly points at a singer, pull that artist's top tracks
  // so searching a name surfaces their actual songs instead of random covers.
  let artistTopTracks: any[] = [];
  if (wantTrack) {
    // Deezer may return several acts with the same name; on a name tie prefer
    // the established one (fan count) so we pull top tracks from the real
    // artist instead of a small duplicate entry with an empty chart.
    // The artist's name appearing as a whole phrase in the query ("skank
    // garota nacional") counts as pointing at that artist too.
    const termNorm = normalize(term);
    const nameInTerm = (name: string): boolean => {
      const n = normalize(name);
      if (!n) return false;
      return (
        termNorm === n ||
        termNorm.startsWith(`${n} `) ||
        termNorm.includes(` ${n} `) ||
        termNorm.endsWith(` ${n}`)
      );
    };
    const bestArtist = deezer.artists
      .map((a: any) => ({ a, s: scoreMatch(term, a.name) }))
      .filter((x) => x.s <= 1 || nameInTerm(x.a.name))
      .sort(
        (x, y) =>
          x.s - y.s ||
          (y.a.fans ?? 0) - (x.a.fans ?? 0)
      )[0];
    if (bestArtist) {
      artistTopTracks = await getDeezerArtistTopTracks(
        String(bestArtist.a.id).replace(/^deezer:/, "")
      ).catch(() => []);
    }
  }

  const contains = { contains: term, mode: "insensitive" as const };

  if (wantTrack) {
    const localTracks = await safeQuery(
      () =>
        prisma.track.findMany({
          where: {
            OR: [
              { title: contains },
              { artist: { name: contains } },
              { album: { title: contains } },
            ],
          },
          include: {
            artist: { select: { id: true, name: true, imageUrl: true } },
            album: { select: { id: true, title: true, coverUrl: true } },
          },
          take: 50,
        }),
      []
    );

    const entries: { track: any; score: number; source: number; idx: number }[] = [];
    const add = (track: any, source: number, idx = 0) => {
      const score = scoreTrack(term, track, resolvedArtist);
      if (score === null) {
        // Local tracks already matched the DB query; never drop those.
        if (source === 0) entries.push({ track, score: 99, source: 0, idx });
        return;
      }
      entries.push({ track, score, source, idx });
    };

    const archiveResult = await searchArchive(term);

    localTracks.forEach((t) => add(t, 0));
    // Externals keep the order their source returned them in (Deezer top =
    // popularity, Deezer search = relevance, archive = relevance), so equal
    // scores don't get reshuffled alphabetically.
    artistTopTracks.forEach((t, i) => add(t, 1, i));
    deezer.tracks.forEach((t, i) => add(t, 2, i));
    searchRemote(term).forEach((t, i) => add(t, 3, i));
    archiveResult.tracks.forEach((t, i) => add(t, 4, i));

    entries.sort(
      (a, b) =>
        a.score - b.score ||
        a.source - b.source ||
        a.idx - b.idx ||
        String(a.track.title || "").localeCompare(String(b.track.title || ""))
    );

    const seen = new Set<string>();
    const dedupe = (items: typeof entries) =>
      items
        .filter((e) => {
          if (seen.has(e.track.id)) return false;
          seen.add(e.track.id);
          return true;
        })
        .map((e) => e.track);

    // Local catalog (the user's own library) always comes first and is never
    // crowded out of the cap by external streaming results.
    const cap = type === "all" ? 30 : limit;
    const locals = entries.filter((e) => e.source === 0);
    const externals = entries.filter((e) => e.source !== 0);
    const finalTracks = collapseDuplicates(dedupe([...locals, ...externals])).slice(
      0,
      cap
    );

    // Swap 30s previews for full-length archive.org streams where a real
    // match exists, then hide anything still on a preview — only tracks that
    // play completely are returned.
    const sourcesById = new Map(entries.map((e) => [e.track.id, e.source]));
    await attachFullAudio(finalTracks, archiveResult.tracks, sourcesById);

    results.tracks = finalTracks.filter(isFullAudio);
  }

  if (wantArtist) {
    const localArtists = await safeQuery(
      () =>
        prisma.artist.findMany({
          where: { name: contains },
          include: { _count: { select: { albums: true, tracks: true } } },
          take: 50,
        }),
      []
    );

    results.artists = sortByRelevance(
      [...localArtists, ...deezer.artists],
      term,
      (a) => a.name,
      (x, y) => ((y as any).fans ?? 0) - ((x as any).fans ?? 0)
    ).slice(0, type === "all" ? 8 : limit);
  }

  if (wantAlbum) {
    const localAlbums = await safeQuery(
      () =>
        prisma.album.findMany({
          where: { title: contains },
          include: {
            artist: { select: { id: true, name: true } },
            _count: { select: { tracks: true } },
          },
          take: 50,
        }),
      []
    );

    results.albums = sortByRelevance(
      [...localAlbums, ...deezer.albums],
      term,
      (a) => a.title
    ).slice(0, type === "all" ? 8 : limit);
  }

  if (wantGenre) {
    const genres = await safeQuery(
      () => prisma.genre.findMany({ where: { name: contains }, take: 50 }),
      []
    );
    results.genres = sortByRelevance(genres, term, (g) => g.name).slice(
      0,
      type === "all" ? 3 : limit
    );
  }

  if (type === "all") {
    const candidates: { type: string; id: string; name: string; score: number }[] = [];

    for (const t of results.tracks) {
      candidates.push({ type: "track", id: t.id, name: t.title, score: scoreTrack(term, t, resolvedArtist) ?? 99 });
    }
    for (const a of results.artists) {
      candidates.push({ type: "artist", id: a.id, name: a.name, score: scoreMatch(term, a.name) });
    }
    for (const a of results.albums) {
      candidates.push({ type: "album", id: a.id, name: a.title, score: scoreMatch(term, a.title) });
    }
    for (const g of results.genres) {
      candidates.push({ type: "genre", id: g.id, name: g.name, score: scoreMatch(term, g.name) });
    }

    const top = candidates.sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return TOP_PRIORITY[a.type] - TOP_PRIORITY[b.type];
    })[0];

    results.top = top ? { type: top.type, id: top.id, name: top.name } : null;
  }

  return results;
}