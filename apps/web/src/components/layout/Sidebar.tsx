import { NavLink, useNavigate } from "react-router-dom";
import {
  Home,
  Search,
  Library,
  Heart,
  ListMusic,
  Plus,
  Music,
  Upload,
  Radio,
} from "lucide-react";
import { useState } from "react";
import { useAuthStore } from "../../stores/authStore";
import { usePlayerStore } from "../../stores/playerStore";
import { useLibraryStore } from "../../stores/libraryStore";
import { createPlaylist } from "../../services/playlists";
import { Button } from "../ui/Button";

export function Sidebar() {
  const navigate = useNavigate();
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const source = usePlayerStore((state) => state.source);
  const playlists = useLibraryStore((state) => state.playlists);
  const refreshPlaylists = useLibraryStore((state) => state.refreshPlaylists);
  const [showNewPlaylist, setShowNewPlaylist] = useState(false);
  const [playlistName, setPlaylistName] = useState("");
  const [playlistError, setPlaylistError] = useState<string | null>(null);

  const handleCreatePlaylist = async () => {
    if (!playlistName.trim()) return;
    setPlaylistError(null);
    try {
      await createPlaylist({ name: playlistName.trim() });
      setPlaylistName("");
      setShowNewPlaylist(false);
      refreshPlaylists();
    } catch (err) {
      setPlaylistError(err instanceof Error ? err.message : "Could not create playlist");
    }
  };

  return (
    <aside className="w-64 shrink-0 h-full bg-surface-100 flex flex-col border-r border-white/5">
      <div className="p-6">
        <h1 className="text-2xl font-bold tracking-tight">
          <span className="text-gradient">VYBE</span>
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">Music that moves you.</p>
      </div>

      <nav className="px-3 space-y-1 flex-1">
        <NavLink
          to="/"
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive ? "bg-vybe-600/15 text-vybe-400" : "text-gray-400 hover:text-white hover:bg-surface-50"
            }`
          }
        >
          <Home className="w-5 h-5" />
          Home
        </NavLink>

        <NavLink
          to="/search"
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive ? "bg-vybe-600/15 text-vybe-400" : "text-gray-400 hover:text-white hover:bg-surface-50"
            }`
          }
        >
          <Search className="w-5 h-5" />
          Search
        </NavLink>

        <button
          onClick={() => navigate("/library")}
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-surface-50 w-full text-left"
        >
          <Library className="w-5 h-5" />
          Library
        </button>

        <NavLink
          to="/upload"
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive ? "bg-vybe-600/15 text-vybe-400" : "text-gray-400 hover:text-white hover:bg-surface-50"
            }`
          }
        >
          <Upload className="w-5 h-5" />
          Upload
        </NavLink>

        <NavLink
          to="/free"
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive ? "bg-vybe-600/15 text-vybe-400" : "text-gray-400 hover:text-white hover:bg-surface-50"
            }`
          }
        >
          <Radio className="w-5 h-5" />
          Free Music
        </NavLink>
      </nav>

      <div className="mt-8 px-3">
        <div className="flex items-center justify-between px-4 mb-2">
          <span className="text-sm font-semibold text-white">Your Library</span>
          <Button
            variant="ghost"
            size="sm"
            className="p-1"
            onClick={() => setShowNewPlaylist(true)}
            type="button"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {showNewPlaylist && (
          <div className="px-2 pb-2">
            <input
              autoFocus
              value={playlistName}
              onChange={(e) => {
                setPlaylistName(e.target.value);
                setPlaylistError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreatePlaylist();
                if (e.key === "Escape") {
                  setPlaylistName("");
                  setShowNewPlaylist(false);
                  setPlaylistError(null);
                }
              }}
              placeholder="Playlist name..."
              className="w-full bg-surface-200 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-vybe-500"
            />
            {playlistError && (
              <p className="text-xs text-red-400 mt-1.5 px-1">{playlistError}</p>
            )}
          </div>
        )}

        <div className="space-y-0.5 max-h-60 overflow-y-auto">
          <NavLink
            to="/liked"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2 rounded-lg text-sm ${
                isActive ? "text-vybe-400 bg-vybe-600/10" : "text-gray-400 hover:text-white hover:bg-surface-50"
              }`
            }
          >
            <Heart className="w-4 h-4 shrink-0" />
            Liked Songs
          </NavLink>

          {playlists.map((playlist) => (
            <NavLink
              key={playlist.id}
              to={`/playlist/${playlist.id}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2 rounded-lg text-sm ${
                  isActive ? "text-vybe-400 bg-vybe-600/10" : "text-gray-400 hover:text-white hover:bg-surface-50"
                }`
              }
            >
              <ListMusic className="w-4 h-4 shrink-0" />
              <span className="truncate">{playlist.name}</span>
            </NavLink>
          ))}
        </div>
      </div>

      <div className="p-4 mt-auto border-t border-white/5">
        {currentTrack ? (
          <button
            onClick={() => source && navigate(source)}
            disabled={!source}
            className={`flex items-center gap-3 w-full text-left ${source ? "cursor-pointer" : "cursor-default"}`}
            title={source ? "Go to where this track was found" : undefined}
          >
            <span className="w-9 h-9 rounded bg-vybe-600/20 flex items-center justify-center text-vybe-400 font-semibold text-xs shrink-0">
              {currentTrack.title[0]}
            </span>
            <div className="min-w-0">
              <p className="text-xs text-white truncate">{currentTrack.title}</p>
              <p className="text-[10px] text-gray-500 truncate">{currentTrack.artist?.name}</p>
            </div>
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded bg-surface-200 flex items-center justify-center text-gray-500 shrink-0">
              <Music className="w-4 h-4" />
            </span>
            <div>
              <p className="text-xs text-gray-500">Nothing playing</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}