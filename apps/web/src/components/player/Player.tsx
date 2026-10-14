import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Volume2,
  VolumeX,
  ListMusic,
  Heart,
  Loader2,
} from "lucide-react";
import { usePlayerStore } from "../../stores/playerStore";
import { formatDuration } from "../music/TrackRow";

export function Player() {
  const {
    currentTrack,
    queue,
    isPlaying,
    currentTime,
    duration,
    volume,
    shuffle,
    repeat,
    loading,
    togglePlay,
    nextTrack,
    prevTrack,
    seek,
    setVolume,
    toggleShuffle,
    cycleRepeat,
    removeFromQueue,
    clearQueue,
  } = usePlayerStore();

  const navigate = useNavigate();
  const source = usePlayerStore((state) => state.source);
  const [showQueue, setShowQueue] = useState(false);
  const progressRef = useRef<HTMLInputElement>(null);
  const volumeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (progressRef.current) {
      const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
      progressRef.current.style.setProperty("--progress", `${pct}%`);
    }
  }, [currentTime, duration]);

  useEffect(() => {
    if (volumeRef.current) {
      volumeRef.current.style.setProperty("--progress", `${volume * 100}%`);
    }
  }, [volume]);

  if (!currentTrack) {
    return null;
  }

  const repeatIcon =
    repeat === "one" ? (
      <Repeat className="w-4 h-4 relative" />
    ) : (
      <Repeat className="w-4 h-4" />
    );

  return (
    <div className="h-24 bg-surface-100 border-t border-white/5 px-4 flex items-center gap-4 relative z-20">
      <div className="flex items-center gap-3 w-64 min-w-0">
        <button
          onClick={() => source && navigate(source)}
          disabled={!source}
          title={source ? "Go to where this track was found" : undefined}
          className={`flex items-center gap-3 min-w-0 text-left ${source ? "cursor-pointer" : "cursor-default"}`}
        >
          <div className="relative w-14 h-14 rounded-lg bg-vybe-600/20 flex items-center justify-center text-vybe-400 font-semibold text-lg shrink-0">
            {currentTrack.title[0]}
            {isPlaying && (
              <span className="absolute -bottom-1 right-0 flex gap-0.5">
                <span className="w-0.5 h-2 bg-vybe-500 animate-pulse-soft rounded-full" />
                <span className="w-0.5 h-3 bg-vybe-500 animate-pulse-soft rounded-full" />
                <span className="w-0.5 h-1.5 bg-vybe-500 animate-pulse-soft rounded-full" />
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{currentTrack.title}</p>
            <p className="text-xs text-gray-400 truncate">{currentTrack.artist?.name}</p>
          </div>
        </button>
        <Heart
          className="w-4 h-4 text-gray-500 hover:text-vybe-500 cursor-pointer transition-colors shrink-0"
          onClick={() => {
            const auth = localStorage.getItem("vybe_token");
            if (!auth) return;
            import("../../services/favorites").then(({ addFavorite }) =>
              addFavorite(currentTrack).catch(() => {})
            );
          }}
        />
      </div>

      <div className="flex-1 flex flex-col items-center gap-2">
        <div className="flex items-center gap-4">
          <button
            onClick={toggleShuffle}
            className={`transition-colors ${shuffle ? "text-vybe-500" : "text-gray-500 hover:text-white"}`}
          >
            <Shuffle className="w-4 h-4" />
          </button>
          <button onClick={prevTrack} className="text-gray-400 hover:text-white">
            <SkipBack className="w-5 h-5 fill-current" />
          </button>
          <button
            onClick={togglePlay}
            className="w-10 h-10 rounded-full bg-white hover:bg-vybe-500 hover:scale-105 flex items-center justify-center transition-all"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 text-black animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-5 h-5 text-black fill-black" />
            ) : (
              <Play className="w-5 h-5 text-black fill-black ml-0.5" />
            )}
          </button>
          <button onClick={nextTrack} className="text-gray-400 hover:text-white">
            <SkipForward className="w-5 h-5 fill-current" />
          </button>
          <button
            onClick={cycleRepeat}
            className={`transition-all relative ${repeat !== "off" ? "text-vybe-500" : "text-gray-500 hover:text-white"}`}
          >
            {repeatIcon}
            {repeat === "one" && (
              <span className="absolute top-1/2 left-1/2 -translate-x-1/2 text-[8px] font-bold">
                1
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-3 w-full max-w-2xl">
          <span className="text-xs text-gray-500 tabular-nums shrink-0 w-10 text-right">
            {formatDuration(currentTime)}
          </span>
          <input
            ref={progressRef}
            type="range"
            min={0}
            max={duration || 1}
            step={0.5}
            value={currentTime}
            onChange={(e) => seek(parseFloat(e.target.value))}
            className="vybe-range flex-1"
          />
          <span className="text-xs text-gray-500 tabular-nums shrink-0 w-10">
            {formatDuration(duration)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 w-64 justify-end">
        <button
          onClick={() => setShowQueue(!showQueue)}
          className={`p-2 rounded-full transition-colors ${
            showQueue ? "text-vybe-500" : "text-gray-500 hover:text-white"
          }`}
        >
          <ListMusic className="w-5 h-5" />
        </button>

        <button
          onClick={() => setVolume(volume === 0 ? 0.7 : 0)}
          className="text-gray-500 hover:text-white"
        >
          {volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
        <input
          ref={volumeRef}
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="vybe-range w-24"
        />
      </div>

      {showQueue && queue.length > 0 && (
        <div className="absolute bottom-full right-4 w-80 max-h-96 overflow-y-auto bg-surface-100 rounded-t-xl border border-white/10 shadow-lg mb-2">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <div>
              <p className="text-sm font-semibold text-white">Queue</p>
              <p className="text-xs text-gray-500">{queue.length} tracks</p>
            </div>
            <button
              onClick={clearQueue}
              className="text-xs text-gray-400 hover:text-white"
            >
              Clear queue
            </button>
          </div>
          <div className="p-2">
            {queue.map((track, index) => (
              <div
                key={`${track.id}-${index}`}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
                  index === usePlayerStore.getState().queueIndex
                    ? "bg-vybe-600/10"
                    : "hover:bg-surface-50"
                }`}
              >
                <span className="w-8 h-8 rounded bg-vybe-600/20 flex items-center justify-center text-vybe-400 text-xs font-semibold shrink-0">
                  {track.title[0]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">{track.title}</p>
                  <p className="text-xs text-gray-500 truncate">{track.artist?.name}</p>
                </div>
                <span className="text-xs text-gray-500 shrink-0">
                  {formatDuration(track.duration)}
                </span>
                <button
                  onClick={() => removeFromQueue(index)}
                  className="text-gray-500 hover:text-white ml-2"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}