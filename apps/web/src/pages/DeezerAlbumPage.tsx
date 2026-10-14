import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { Track } from "@vybe/shared";
import { discoverAlbum } from "../services/discover";
import { usePlayerStore } from "../stores/playerStore";
import { TrackRow } from "../components/music/TrackRow";
import { Spinner } from "../components/ui/Spinner";
import { Button } from "../components/ui/Button";
import { Play, Music } from "lucide-react";

export function DeezerAlbumPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [album, setAlbum] = useState<{
    id: string;
    title: string;
    coverUrl: string | null;
    artistId: string;
    artist: { id: string; name: string };
    _count: { tracks: number };
    tracks: Track[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const playQueue = usePlayerStore((state) => state.playQueue);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    discoverAlbum(id)
      .then(setAlbum)
      .catch((err) => setError(err.message || "Failed to load album"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Spinner />;
  if (error) return <div className="text-center py-12 text-red-400">{error}</div>;
  if (!album) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end gap-6">
        {album.coverUrl ? (
          <img
            src={album.coverUrl}
            alt={album.title}
            className="w-48 h-48 rounded-2xl object-cover shrink-0"
          />
        ) : (
          <div className="w-48 h-48 rounded-2xl bg-gradient-to-br from-surface-300 to-surface-200 flex items-center justify-center shrink-0">
            <Music className="w-16 h-16 text-gray-500" />
          </div>
        )}
        <div className="flex-1">
          <p className="text-xs font-medium text-vybe-400 mb-2">ALBUM</p>
          <h1 className="text-4xl font-bold mb-2">{album.title}</h1>
          <button
            onClick={() => navigate(`/deezer/artist/${album.artistId}`)}
            className="text-gray-300 hover:text-white hover:underline transition-colors"
          >
            {album.artist.name}
          </button>
          <p className="text-sm text-gray-500 mt-1">
            {album._count.tracks} tracks
          </p>
          <div className="flex gap-3 mt-4">
            {album.tracks.length > 0 && (
              <Button onClick={() => playQueue(album.tracks, 0)}>
                <Play className="w-4 h-4 fill-white" /> Play
              </Button>
            )}
          </div>
        </div>
      </div>

      {album.tracks.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400">No tracks available</p>
        </div>
      ) : (
        <div className="space-y-1">
          {album.tracks.map((track, index) => (
            <TrackRow
              key={track.id}
              track={track}
              index={index}
              tracks={album.tracks}
              showAlbum={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}