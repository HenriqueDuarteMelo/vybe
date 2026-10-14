import { useEffect, useState } from "react";
import type { Playlist } from "@vybe/shared";
import { useLibraryStore } from "../stores/libraryStore";
import { createPlaylist } from "../services/playlists";
import { ListMusic, Music, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Spinner } from "../components/ui/Spinner";
import { Button } from "../components/ui/Button";

export function LibraryPage() {
  const navigate = useNavigate();
  const { playlists: libraryPlaylists, loadPlaylists, refreshPlaylists } = useLibraryStore();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [playlistName, setPlaylistName] = useState("");
  const [creatingError, setCreatingError] = useState<string | null>(null);

  useEffect(() => {
    loadPlaylists().finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!playlistName.trim()) return;
    setCreatingError(null);
    try {
      await createPlaylist({ name: playlistName.trim() });
      await refreshPlaylists();
      setPlaylistName("");
      setCreating(false);
    } catch (err) {
      setCreatingError(err instanceof Error ? err.message : "Could not create playlist");
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Your Library</h1>
          <p className="text-gray-400 mt-1">Manage your playlists</p>
        </div>
        <Button
          onClick={() => {
            setCreating((v) => !v);
            setCreatingError(null);
          }}
        >
          <Plus className="w-4 h-4" /> New playlist
        </Button>
      </div>

      {creating && (
        <div className="bg-surface-50 rounded-xl border border-white/5 p-4 flex flex-col sm:flex-row gap-3">
          <input
            autoFocus
            value={playlistName}
            onChange={(e) => {
              setPlaylistName(e.target.value);
              setCreatingError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") {
                setPlaylistName("");
                setCreating(false);
                setCreatingError(null);
              }
            }}
            placeholder="Playlist name..."
            className="flex-1 bg-surface-200 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-vybe-500"
          />
          <div className="flex gap-2">
            <Button onClick={handleCreate}>Create</Button>
            <Button
              variant="outline"
              onClick={() => {
                setPlaylistName("");
                setCreating(false);
                setCreatingError(null);
              }}
            >
              Cancel
            </Button>
          </div>
          {creatingError && (
            <p className="text-sm text-red-400 sm:hidden">{creatingError}</p>
          )}
        </div>
      )}

      {creatingError && creating && (
        <p className="text-sm text-red-400 hidden sm:block">{creatingError}</p>
      )}

      {libraryPlaylists.length === 0 ? (
        <div className="text-center py-16 bg-surface-50 rounded-2xl border border-white/5">
          <Music className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl text-white font-semibold">No playlists yet</h3>
          <p className="text-gray-400 mt-2 text-sm">
            Click "New playlist" above to create your first playlist.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {libraryPlaylists.map((playlist: Playlist) => (
            <button
              key={playlist.id}
              onClick={() => navigate(`/playlist/${playlist.id}`)}
              className="group text-left bg-surface-50 rounded-xl border border-white/5 p-4 overflow-hidden hover-lift"
            >
              <div className="relative aspect-square rounded-lg bg-gradient-to-br from-surface-300 to-surface-200 flex items-center justify-center mb-3">
                <ListMusic className="w-12 h-12 text-gray-500 group-hover:text-vybe-400" />
              </div>
              <p className="text-sm font-medium text-white truncate">{playlist.name}</p>
              <p className="text-xs text-gray-400">
                {playlist._count?.tracks ?? 0} tracks
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}