import { api } from "./api";
import type { Track, PaginatedResponse } from "@vybe/shared";

export async function getTracks(params?: {
  page?: number;
  limit?: number;
  genreId?: string;
  artistId?: string;
  albumId?: string;
}): Promise<PaginatedResponse<Track>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.genreId) searchParams.set("genreId", params.genreId);
  if (params?.artistId) searchParams.set("artistId", params.artistId);
  if (params?.albumId) searchParams.set("albumId", params.albumId);
  const qs = searchParams.toString();
  return api.get<PaginatedResponse<Track>>(`/tracks${qs ? `?${qs}` : ""}`);
}

export async function getTrackById(id: string): Promise<Track> {
  return api.get<Track>(`/tracks/${id}`);
}

export async function uploadTrack(formData: FormData): Promise<Track> {
  return api.post<Track>("/tracks", formData);
}
