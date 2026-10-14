import { api } from "./api";
import type { Favorite, Track } from "@vybe/shared";
import { toImportPayload } from "../lib/trackImport";

export async function getFavorites(): Promise<Favorite[]> {
  return api.get<Favorite[]>("/favorites");
}

export async function addFavorite(track: Track): Promise<void> {
  const payload = toImportPayload(track);
  return api.post(
    `/tracks/${track.id}/favorite`,
    payload ? { track: payload } : undefined
  );
}

export async function removeFavorite(trackId: string): Promise<void> {
  return api.delete(`/tracks/${trackId}/favorite`);
}

export async function checkFavorite(trackId: string): Promise<boolean> {
  const result = await api.get<{ isFavorited: boolean }>(
    `/tracks/${trackId}/favorite/status`
  );
  return result.isFavorited;
}
