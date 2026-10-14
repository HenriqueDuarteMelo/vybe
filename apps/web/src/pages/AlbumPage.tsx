import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { Album } from "@vybe/shared";
import { getAlbumById } from "../services/albums";
import { usePlayerStore } from "../stores/playerStore";
import { TrackRow } from "../components/music/TrackRow";
import { Spinner } from "../components/ui/Spinner";
import { Button } from "../components/ui/Button";
import { Play, Disc3 } from "lucide-react";

export function AlbumPage() {
  const { id } = useParams<{ id: string }>();
  const [album, setAlbum] = useState<Album | null>(null);
  const [loading, setLoading] = useState(true);
  const playQueue = usePlayerStore((state) => state.playQueue);

  useEffect(() => {
    if (!id) return;
    getAlbumById(id)
      .then(setAlbum)
      .catch((err) => console.error("Failed to load album", err))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Spinner />;
  if (!album) return null;

  const tracks = album.tracks ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end gap-6">
        <div className="w-48 h-48 rounded-2xl bg-gradient-to-br from-vybe-600/40 to-surface-300 flex items-center justify-center shrink-0 border border-white/10">
          <Disc3 className="w-16 h-16 text-vybe-500/50" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-medium text-vybe-400 mb-2">ALBUM</p>
          <h1 className="text-4xl font-bold mb-2">{album.title}</h1>
          <p className="text-gray-400">
            {album.artist?.name}
            {album.releaseYear ? ` · ${album.releaseYear}` : ""}
            {tracks.length ? ` · ${tracks.length} tracks` : ""}
          </p>
          {tracks.length > 0 && (
            <Button className="mt-4" onClick={() => playQueue(tracks, 0)}>
              <Play className="w-4 h-4 fill-white" /> Play
            </Button>
          )}
        </div>
      </div>

      {tracks.length === 0 ? (
        <p className="text-gray-400">No tracks in this album.</p>
      ) : (
        <div className="space-y-1">
          {tracks.map((track, index) => (
            <TrackRow key={track.id} track={track} index={index} tracks={tracks} showAlbum={false} />
          ))}
        </div>
      )}
    </div>
  );
}