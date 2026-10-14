import { api } from "./api";
import type { SearchResults } from "@vybe/shared";

function dedupeById<T extends { id: string }>(arr: T[]): T[] {
  const seen = new Set<string>();
  return arr.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export async function search(
  q: string,
  type?: string,
): Promise<SearchResults> {
  const searchParams = new URLSearchParams({ q });
  if (type) searchParams.set("type", type);

  const backend = await api
    .get<SearchResults>(`/search?${searchParams.toString()}`)
    .catch(() => ({
      top: null,
      tracks: [],
      artists: [],
      albums: [],
      genres: [],
    }));

  const tracks = dedupeById(backend.tracks ?? []);
  const artists = dedupeById(backend.artists ?? []);
  const albums = dedupeById(backend.albums ?? []);
  const genres = backend.genres ?? [];

  let top = backend.top;
  if (!top && tracks.length > 0) {
    top = { type: "track", id: tracks[0].id, name: tracks[0].title };
  } else if (!top && artists.length > 0) {
    top = { type: "artist", id: artists[0].id, name: artists[0].name };
  }

  return { top, tracks, artists, albums, genres };
}
