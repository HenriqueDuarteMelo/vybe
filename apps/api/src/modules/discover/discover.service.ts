import { relayJson, proxiedImageUrl } from "../../utils/relay.js";

const DEEZER_BASE = "https://api.deezer.com";

const TTL_SEARCH = 5 * 60_000;
const TTL_DETAIL = 30 * 60_000;

interface DeezerTrack {
  id: number;
  title: string;
  title_short?: string;
  duration: number;
  preview: string;
  artist: { id: number; name: string; picture_medium: string };
  album: { id: number; title: string; cover_medium: string };
}

interface DeezerArtist {
  id: number;
  name: string;
  picture_medium: string;
  nb_album: number;
  nb_fan: number;
}

interface DeezerAlbum {
  id: number;
  title: string;
  cover_medium: string;
  // /artist/{id}/albums returns album objects without the nested artist.
  artist?: { id: number; name: string };
  nb_tracks: number;
}

async function deezerFetch<T>(path: string, ttlMs = TTL_SEARCH): Promise<T> {
  // A relay occasionally serves a stale/corrupt copy where the list body is
  // smaller than the reported total (observed: total=192 with 1 item). Deezer
  // fills lists up to min(limit, total), so anything shorter is degraded —
  // reject it and let relayJson fall through to the next strategy.
  const limitMatch = /(?:[?&])limit=(\d+)/.exec(path);
  const limit = limitMatch ? Number(limitMatch[1]) : null;
  const plausible = (value: unknown): boolean => {
    if (!value || typeof value !== "object") return false;
    const body = value as { data?: unknown; total?: unknown };
    if (!Array.isArray(body.data)) return true; // detail/error payloads
    if (typeof body.total !== "number" || !limit) return true;
    return body.data.length >= Math.min(limit, body.total);
  };
  return relayJson<T>(`${DEEZER_BASE}${path}`, { ttlMs, plausible });
}

function mapTrack(t: DeezerTrack) {
  return {
    id: `deezer:${t.id}`,
    title: t.title,
    duration: t.duration,
    audioUrl: null,
    previewUrl: t.preview,
    trackNumber: null,
    albumId: `deezer:${t.album.id}`,
    artistId: `deezer:${t.artist.id}`,
    artist: {
      id: `deezer:${t.artist.id}`,
      name: t.artist.name,
      imageUrl: proxiedImageUrl(t.artist.picture_medium),
      bio: null,
    },
    album: {
      id: `deezer:${t.album.id}`,
      title: t.album.title,
      coverUrl: proxiedImageUrl(t.album.cover_medium),
      artistId: `deezer:${t.artist.id}`,
    },
    genres: [],
  };
}

function mapArtist(a: DeezerArtist) {
  return {
    id: `deezer:${a.id}`,
    name: a.name,
    imageUrl: proxiedImageUrl(a.picture_medium),
    bio: null,
    // Used downstream to break ties between duplicate artist entries (e.g.
    // several acts called "Skank") in favor of the established one.
    fans: a.nb_fan,
    _count: { albums: a.nb_album, tracks: 0 },
  };
}

function mapAlbum(a: DeezerAlbum, fallbackArtist?: { id: string; name: string }) {
  return {
    id: `deezer:${a.id}`,
    title: a.title,
    coverUrl: proxiedImageUrl(a.cover_medium),
    artistId: a.artist ? `deezer:${a.artist.id}` : fallbackArtist?.id ?? null,
    artist: a.artist
      ? { id: `deezer:${a.artist.id}`, name: a.artist.name }
      : fallbackArtist ?? null,
    _count: { tracks: a.nb_tracks },
  };
}

export async function searchDeezer(query: string) {
  const [trackRes, artistRes, albumRes] = await Promise.all([
    deezerFetch<{ data: DeezerTrack[] }>(
      `/search?q=${encodeURIComponent(query)}&limit=15`
    ).catch(() => ({ data: [] })),
    deezerFetch<{ data: DeezerArtist[] }>(
      `/search/artist?q=${encodeURIComponent(query)}&limit=6`
    ).catch(() => ({ data: [] })),
    deezerFetch<{ data: DeezerAlbum[] }>(
      `/search/album?q=${encodeURIComponent(query)}&limit=6`
    ).catch(() => ({ data: [] })),
  ]);

  return {
    tracks: (trackRes.data ?? []).map(mapTrack),
    artists: (artistRes.data ?? []).map(mapArtist),
    albums: (albumRes.data ?? []).map((a) => mapAlbum(a)),
  };
}

export async function getDeezerArtist(deezerId: string) {
  const artist = await deezerFetch<DeezerArtist>(`/artist/${deezerId}`, TTL_DETAIL);
  return mapArtist(artist);
}

export async function getDeezerArtistTopTracks(deezerId: string) {
  const res = await deezerFetch<{ data: DeezerTrack[] }>(
    `/artist/${deezerId}/top?limit=30`,
    TTL_DETAIL
  );
  return (res.data ?? []).map(mapTrack);
}

export async function getDeezerArtistAlbums(deezerId: string) {
  const [res, artist] = await Promise.all([
    deezerFetch<{ data: DeezerAlbum[] }>(`/artist/${deezerId}/albums`, TTL_DETAIL),
    // Albums from this endpoint carry no artist — fill it from the artist
    // lookup (the route fetches the same URL concurrently, so the relay
    // request is shared).
    getDeezerArtist(deezerId).catch(() => null),
  ]);
  const fallback = artist
    ? { id: `deezer:${deezerId}`, name: artist.name }
    : undefined;
  return (res.data ?? []).map((a) => mapAlbum(a, fallback));
}

export async function getDeezerAlbum(deezerId: string) {
  const albumRes = await deezerFetch<
    DeezerAlbum & { tracks: { data: DeezerTrack[] } }
  >(`/album/${deezerId}`, TTL_DETAIL);

  const album = mapAlbum(albumRes);
  const tracks = (albumRes.tracks?.data ?? []).map(mapTrack);

  return { ...album, tracks };
}