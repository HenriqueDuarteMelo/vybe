import { api } from "./api";
import type { Album, PaginatedResponse } from "@vybe/shared";

export async function getAlbums(params?: {
  page?: number;
  limit?: number;
  artistId?: string;
}): Promise<PaginatedResponse<Album>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.artistId) searchParams.set("artistId", params.artistId);
  const qs = searchParams.toString();
  return api.get<PaginatedResponse<Album>>(`/albums${qs ? `?${qs}` : ""}`);
}

export async function getAlbumById(id: string): Promise<Album> {
  return api.get<Album>(`/albums/${id}`);
}
