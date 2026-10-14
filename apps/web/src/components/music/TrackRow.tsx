import { useEffect, useRef, useState } from "react";
import type { Track } from "@vybe/shared";
import { Play, Pause, Heart, Plus, ListMusic, Check, Loader2 } from "lucide-react";
import { usePlayerStore } from "../../stores/playerStore";
import { useLibraryStore } from "../../stores/libraryStore";
import { addTrackToPlaylist, createPlaylist } from "../../services/playlists";

interface TrackRowProps {
  track: Track;
  index?: number;
  tracks?: Track[];
  isFavorited?: boolean;
  onToggleFavorite?: (track: Track) => void;
  showAlbum?: boolean;
  draggable?: boolean;
  dragOver?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

export function TrackRow({
  track,
  index,
  tracks,
  isFavorited,
  onToggleFavorite,
  showAlbum = true,
  draggable,
  dragOver,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: TrackRowProps) {
  const { currentTrack, isPlaying, toggle, play } = usePlayerStore();
  const playlists = useLibraryStore((state) => state.playlists);
  const refreshPlaylists = useLibraryStore((state) => state.refreshPlaylists);
  const isCurrent = currentTrack?.id === track.id;

  const [menuOpen, setMenuOpen] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setFeedback(null);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const inPlaylist = (playlistId: string) =>
    playlists
      .find((p) => p.id === playlistId)
      ?.tracks?.some((pt) => pt.track.id === track.id) ?? false;

  const handlePlay = () => {
    if (isCurrent) {
      toggle();
    } else if (tracks && tracks.length > 0) {
      play(tracks, index ?? tracks.indexOf(track));
    } else {
      play([track], 0);
    }
  };

  const handleAddToPlaylist = async (playlistId: string) => {
    if (adding) return;
    setAdding(playlistId);
    setFeedback(null);
    try {
      await addTrackToPlaylist(playlistId, track);
      const pl = playlists.find((p) => p.id === playlistId);
      setFeedback(`Added to "${pl?.name ?? "playlist"}"`);
      refreshPlaylists();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Could not add track");
    } finally {
      setAdding(null);
    }
  };

  const handleCreateAndAdd = async () => {
    const name = window.prompt("New playlist name");
    if (!name || !name.trim()) return;
    setFeedback(null);
    try {
      const playlist = await createPlaylist({ name: name.trim() });
      await handleAddToPlaylist(playlist.id);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Could not create playlist");
    }
  };

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`group grid grid-cols-[2rem_1fr_2rem_1fr_1fr] md:grid-cols-[3rem_minmax(12rem,1.5fr)_minmax(8rem,1fr)_minmax(6rem,1fr)_2rem] items-center gap-4 px-4 py-2 rounded-lg ${
        isCurrent ? "bg-vybe-600/10" : "hover:bg-surface-50"
      } ${dragOver ? "ring-2 ring-vybe-500/70" : ""} ${
        draggable ? "cursor-grab active:cursor-grabbing" : ""
      }`}
    >
      <div className="flex items-center justify-center">
        {index !== undefined && !isCurrent && (
          <span className="text-sm text-gray-500 group-hover:hidden">{index + 1}</span>
        )}
        <button
          onClick={handlePlay}
          className="hidden group-hover:flex items-center text-gray-400 hover:text-white"
        >
          {isCurrent && isPlaying ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4" />
          )}
        </button>
        {isCurrent && (
          <span className={`w-2 h-2 rounded-full bg-vybe-500 ${isPlaying ? "animate-pulse-soft" : ""}`} />
        )}
      </div>

      <div className="flex items-center gap-3 min-w-0">
        <div className="relative w-10 h-10 rounded bg-vybe-600/20 flex items-center justify-center text-vybe-400 text-sm font-semibold shrink-0">
          {track.title[0]}
        </div>
        <div className="min-w-0">
          <p className={`text-sm truncate ${isCurrent ? "text-vybe-400" : "text-white"}`}>
            {track.title}
          </p>
          <p className="text-xs text-gray-400 truncate">{track.artist?.name}</p>
        </div>
      </div>

      {showAlbum && (
        <p className="text-sm text-gray-400 truncate hidden md:block">
          {track.album?.title ?? track.album?.title}
        </p>
      )}

      <div className="flex items-center justify-center gap-1">
        {onToggleFavorite && (
          <button
            onClick={() => onToggleFavorite(track)}
            className={`flex items-center justify-center transition-colors ${
              isFavorited ? "text-vybe-500" : "text-gray-500 hover:text-white"
            }`}
          >
            <Heart className={`w-4 h-4 ${isFavorited ? "fill-current" : ""}`} />
          </button>
        )}
          <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className={`flex items-center justify-center transition-colors ${
              menuOpen ? "text-vybe-400" : "text-gray-500 group-hover:text-white"
            }`}
            title="Add to Library"
          >
            <Plus className={`w-4 h-4 ${menuOpen ? "rotate-45 transition-transform" : ""}`} />
          </button>
          {menuOpen && (
            <div className="absolute z-30 right-0 top-full mt-1 w-64 max-h-72 overflow-y-auto bg-surface-200 rounded-xl border border-white/10 shadow-lg py-1">
              <p className="px-3 py-1.5 text-xs text-gray-400 font-medium truncate">
                Add "{track.title}" to...
              </p>
              {playlists.length === 0 && (
                <p className="px-3 py-1.5 text-xs text-gray-500">
                  No playlists yet. Create one below.
                </p>
              )}
              {playlists.map((playlist) => (
                <button
                  key={playlist.id}
                  onClick={() => handleAddToPlaylist(playlist.id)}
                  disabled={adding === playlist.id}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-white hover:bg-surface-50 disabled:opacity-60"
                >
                  <ListMusic className="w-4 h-4 text-gray-500 shrink-0" />
                  <span className="truncate flex-1">{playlist.name}</span>
                  {adding === playlist.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-vybe-400 shrink-0" />
                  ) : inPlaylist(playlist.id) ? (
                    <Check className="w-4 h-4 text-vybe-400 shrink-0" />
                  ) : null}
                </button>
              ))}
              <button
                onClick={handleCreateAndAdd}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-vybe-400 hover:bg-surface-50"
              >
                <Plus className="w-4 h-4 shrink-0" />
                New playlist
              </button>
              {feedback && (
                <p className="px-3 py-1.5 pt-2 text-xs text-gray-400 border-t border-white/5">
                  {feedback}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <span className="text-sm tabular-nums text-gray-500">
        {formatDuration(track.duration)}
      </span>
    </div>
  );
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}