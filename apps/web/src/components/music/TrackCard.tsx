import type { Track } from "@vybe/shared";
import { Play, Heart } from "lucide-react";
import { usePlayerStore } from "../../stores/playerStore";

interface TrackCardProps {
  track: Track;
  onPlay?: (track: Track, tracks: Track[]) => void;
  isFavorited?: boolean;
  onToggleFavorite?: (track: Track) => void;
}

export function TrackCard({
  track,
  onPlay,
  isFavorited,
  onToggleFavorite,
}: TrackCardProps) {
  const playTrack = usePlayerStore((state) => state.playTrack);

  const handlePlay = () => {
    if (onPlay) {
      onPlay(track, [track]);
    } else {
      playTrack(track, [track], 0);
    }
  };

  return (
    <div className="group bg-surface-50 rounded-xl border border-white/5 overflow-hidden hover-lift">
      <div className="relative aspect-square bg-gradient-to-br from-vybe-600/30 to-surface-200 flex items-center justify-center">
        <span className="text-5xl font-bold text-vybe-500/30 group-hover:opacity-0 transition-opacity">
          {track.title[0]}
        </span>
        <button
          onClick={handlePlay}
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <span className="w-14 h-14 rounded-full bg-vybe-600 flex items-center justify-center glow-vybe">
            <Play className="w-6 h-6 text-white fill-white ml-0.5" />
          </span>
        </button>
        {onToggleFavorite && isFavorited !== undefined && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(track);
            }}
            className={`absolute top-2 right-2 p-2 rounded-full transition-all ${
              isFavorited ? "text-vybe-400 bg-surface/60" : "text-white/60 hover:text-white"
            }`}
          >
            <Heart className={`w-4 h-4 ${isFavorited ? "fill-current" : ""}`} />
          </button>
        )}
      </div>
      <div className="p-3">
        <p className="text-sm font-medium text-white truncate">{track.title}</p>
        <p className="text-xs text-gray-400 truncate">{track.artist?.name}</p>
      </div>
    </div>
  );
}