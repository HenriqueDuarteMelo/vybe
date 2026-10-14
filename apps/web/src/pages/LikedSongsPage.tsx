import { useEffect, useState } from "react";
import type { Favorite } from "@vybe/shared";
import { getFavorites, removeFavorite, addFavorite } from "../services/favorites";
import { usePlayerStore } from "../stores/playerStore";
import { TrackRow } from "../components/music/TrackRow";
import { Spinner } from "../components/ui/Spinner";
import { Button } from "../components/ui/Button";
import { Play, Heart, Music } from "lucide-react";

export function LikedSongsPage() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const playQueue = usePlayerStore((state) => state.playQueue);

  useEffect(() => {
    getFavorites()
      .then(setFavorites)
      .catch((err) => console.error("Failed to load favorites", err))
      .finally(() => setLoading(false));
  }, []);

  const tracks = favorites.map((f) => f.track);

  const toggleFavorite = async (trackId: string) => {
    try {
      await removeFavorite(trackId);
      setFavorites((prev) => prev.filter((f) => f.track.id !== trackId));
    } catch (err) {
      console.error("Failed to remove favorite", err);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-end gap-6">
        <div className="w-48 h-48 rounded-2xl bg-gradient-to-br from-vybe-600 to-vybe-800 flex items-center justify-center shrink-0">
          <Heart className="w-16 h-16 text-white fill-white" />
        </div>
        <div>
          <p className="text-xs font-medium text-vybe-400 mb-2">PLAYLIST</p>
          <h1 className="text-4xl font-bold mb-2">Liked Songs</h1>
          <p className="text-sm text-gray-500">{tracks.length} tracks</p>
          {tracks.length > 0 && (
            <Button className="mt-4" onClick={() => playQueue(tracks, 0)}>
              <Play className="w-4 h-4 fill-white" /> Play
            </Button>
          )}
        </div>
      </div>

      {tracks.length === 0 ? (
        <div className="text-center py-12 bg-surface-50 rounded-2xl border border-white/5">
          <Music className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">No liked songs yet. Tap the heart to save music you love.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {tracks.map((track, index) => (
            <TrackRow
              key={track.id}
              track={track}
              index={index}
              tracks={tracks}
              isFavorited
              onToggleFavorite={(t) => {
                toggleFavorite(t.id);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}