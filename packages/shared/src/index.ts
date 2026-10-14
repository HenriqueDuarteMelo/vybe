export interface User {
  id: string;
  email: string;
  username: string;
  avatarUrl: string | null;
  createdAt: string;
}

export interface Artist {
  id: string;
  name: string;
  bio: string | null;
  imageUrl: string | null;
  _count?: { albums: number; tracks: number };
}

export interface Album {
  id: string;
  title: string;
  coverUrl: string | null;
  releaseYear: number | null;
  artistId: string;
  artist?: Artist;
  tracks?: Track[];
  _count?: { tracks: number };
}

export interface Track {
  id: string;
  title: string;
  duration: number;
  audioUrl: string | null;
  previewUrl?: string;
  trackNumber: number | null;
  albumId: string;
  artistId: string;
  artist?: Artist;
  album?: Album;
  genres?: Genre[];
  _count?: { favorites: number };
}

export interface Genre {
  id: string;
  name: string;
  _count?: { tracks: number };
}

export interface Playlist {
  id: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  isPublic: boolean;
  userId: string;
  user?: Pick<User, "id" | "username" | "avatarUrl">;
  tracks?: PlaylistTrack[];
  _count?: { tracks: number };
}

export interface PlaylistTrack {
  id: string;
  position: number;
  addedAt: string;
  track: Track;
}

export interface Favorite {
  id: string;
  track: Track;
  createdAt: string;
}

export interface ListeningHistoryEntry {
  id: string;
  track: Track;
  playedAt: string;
}

export interface PaginatedResponse<T> {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  data?: T[];
  tracks?: T[];
  artists?: T[];
  albums?: T[];
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface SearchTopResult {
  type: "track" | "artist" | "album" | "genre";
  id: string;
  name: string;
}

export interface SearchResults {
  top: SearchTopResult | null;
  tracks: Track[];
  artists: Artist[];
  albums: Album[];
  genres: Genre[];
}

export type RepeatMode = "off" | "all" | "one";

export interface PlayerState {
  currentTrack: Track | null;
  queue: Track[];
  queueIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
}
