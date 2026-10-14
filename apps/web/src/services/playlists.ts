import { api } from "./api";
import type { Playlist, Track } from "@vybe/shared";
import { toImportPayload } from "../lib/trackImport";

export async function getUserPlaylists(): Promise<Playlist[]> {
  return api.get<Playlist[]>("/playlists");
}

export async function getPlaylistById(id: string): Promise<Playlist> {
  return api.get<Playlist>(`/playlists/${id}`);
}

export async function createPlaylist(data: {
  name: string;
  description?: string;
  isPublic?: boolean;
}): Promise<Playlist> {
  return api.post<Playlist>("/playlists", data);
}

export async function updatePlaylist(
  id: string,
  data: { name?: string; description?: string; isPublic?: boolean }
): Promise<Playlist> {
  return api.put<Playlist>(`/playlists/${id}`, data);
}

export async function deletePlaylist(id: string): Promise<void> {
  return api.delete<void>(`/playlists/${id}`);
}

export async function addTrackToPlaylist(
  playlistId: string,
  track: Track
): Promise<unknown> {
  const payload = toImportPayload(track);
  return api.post(`/playlists/${playlistId}/tracks`, {
    trackId: track.id,
    ...(payload ? { track: payload } : {}),
  });
}

export async function removeTrackFromPlaylist(
  playlistId: string,
  trackId: string
): Promise<void> {
  return api.delete<void>(`/playlists/${playlistId}/tracks/${trackId}`);
}

export async function reorderPlaylist(
  playlistId: string,
  trackIds: string[]
): Promise<void> {
  return api.put(`/playlists/${playlistId}/reorder`, { trackIds });
}
