import { api } from "./api";
import type { Track } from "@vybe/shared";

export interface DiscoverSearchResults {
  tracks: Track[];
  artists: Array<{
    id: string;
    name: string;
    imageUrl: string | null;
    bio: string | null;
    _count: { albums: number; tracks: number };
  }>;
  albums: Array<{
    id: string;
    title: string;
    coverUrl: string | null;
    artistId: string;
    artist: { id: string; name: string };
    _count: { tracks: number };
  }>;
}

export interface DiscoverArtistDetail {
  artist: {
    id: string;
    name: string;
    imageUrl: string | null;
    bio: string | null;
    _count: { albums: number; tracks: number };
  };
  topTracks: Track[];
  albums: Array<{
    id: string;
    title: string;
    coverUrl: string | null;
    artist: { id: string; name: string };
    _count: { tracks: number };
  }>;
}

export interface DiscoverAlbumDetail {
  id: string;
  title: string;
  coverUrl: string | null;
  artistId: string;
  artist: { id: string; name: string };
  _count: { tracks: number };
  tracks: Track[];
}

export async function discoverSearch(q: string): Promise<DiscoverSearchResults> {
  const searchParams = new URLSearchParams({ q });
  return api.get<DiscoverSearchResults>(`/discover/search?${searchParams.toString()}`);
}

export async function discoverArtist(id: string): Promise<DiscoverArtistDetail> {
  const cleanId = id.replace("deezer:", "");
  return api.get<DiscoverArtistDetail>(`/discover/artist/${cleanId}`);
}

export async function discoverAlbum(id: string): Promise<DiscoverAlbumDetail> {
  const cleanId = id.replace("deezer:", "");
  return api.get<DiscoverAlbumDetail>(`/discover/album/${cleanId}`);
}