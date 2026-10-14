import type { Track } from "@vybe/shared";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isRemoteTrackId(id: string): boolean {
  return !UUID_RE.test(id);
}

export interface ImportTrackPayload {
  id: string;
  title: string;
  duration: number;
  audioUrl: string | null;
  trackNumber: number | null;
  artistId: string | null;
  artistName: string;
  artistImageUrl: string | null;
  albumId: string | null;
  albumTitle: string;
  albumCoverUrl: string | null;
}

export function toImportPayload(track: Track): ImportTrackPayload | undefined {
  if (!isRemoteTrackId(track.id)) return undefined;

  const playable =
    track.audioUrl && track.audioUrl.startsWith("http")
      ? track.audioUrl
      : track.previewUrl ?? null;

  return {
    id: track.id,
    title: track.title,
    duration: Math.max(0, Math.round(track.duration || 0)),
    audioUrl: playable,
    trackNumber: track.trackNumber ?? null,
    artistId: track.artistId ?? null,
    artistName: track.artist?.name ?? "Unknown Artist",
    artistImageUrl: track.artist?.imageUrl ?? null,
    albumId: track.albumId ?? null,
    albumTitle: track.album?.title ?? "Unknown Album",
    albumCoverUrl: track.album?.coverUrl ?? null,
  };
}
