import { api } from "./api";
import type { Artist, Track, PaginatedResponse } from "@vybe/shared";

export async function getArtists(params?: {
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<Artist>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  const qs = searchParams.toString();
  return api.get<PaginatedResponse<Artist>>(`/artists${qs ? `?${qs}` : ""}`);
}

export async function getArtistById(id: string): Promise<Artist> {
  return api.get<Artist>(`/artists/${id}`);
}

export async function getArtistTopTracks(id: string, limit?: number): Promise<Track[]> {
  const qs = limit ? `?limit=${limit}` : "";
  return api.get<Track[]>(`/artists/${id}/top-tracks${qs}`);
}
