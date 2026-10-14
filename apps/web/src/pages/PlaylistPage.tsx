import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { Playlist, Track } from "@vybe/shared";
import { getPlaylistById, deletePlaylist, reorderPlaylist } from "../services/playlists";
import { usePlayerStore } from "../stores/playerStore";
import { useLibraryStore } from "../stores/libraryStore";
import { useAuthStore } from "../stores/authStore";
import { TrackRow } from "../components/music/TrackRow";
import { Spinner } from "../components/ui/Spinner";
import { Button } from "../components/ui/Button";
import { Play, Trash2, Music, GripVertical } from "lucide-react";

export function PlaylistPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const playQueue = usePlayerStore((state) => state.playQueue);
  const refreshPlaylists = useLibraryStore((state) => state.refreshPlaylists);
  const authUser = useAuthStore((state) => state.user);

  useEffect(() => {
    if (!id) return;
    getPlaylistById(id)
      .then((p) => {
        setPlaylist(p);
        setTracks((p.tracks ?? []).map((pt) => pt.track));
      })
      .catch(() => navigate("/library"))
      .finally(() => setLoading(false));
  }, [id]);

  const isOwner = !!playlist && playlist.user?.id === authUser?.id;

  const handleDelete = async () => {
    if (!playlist) return;
    if (!confirm(`Delete playlist "${playlist.name}"?`)) return;
    try {
      await deletePlaylist(playlist.id);
      await refreshPlaylists();
      navigate("/library");
    } catch (err) {
      console.error("Failed to delete playlist", err);
    }
  };

  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  };

  const handleDragOver = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (overIndex !== index) setOverIndex(index);
  };

  const handleDrop = (index: number) => async (e: React.DragEvent) => {
    e.preventDefault();
    const from = dragIndex ?? parseInt(e.dataTransfer.getData("text/plain"), 10);
    setDragIndex(null);
    setOverIndex(null);
    if (Number.isNaN(from) || from === index || !playlist) return;

    const next = [...tracks];
    const [moved] = next.splice(from, 1);
    next.splice(index, 0, moved);
    setTracks(next);

    try {
      await reorderPlaylist(playlist.id, next.map((t) => t.id));
      refreshPlaylists();
    } catch (err) {
      console.error("Failed to reorder playlist", err);
      const fresh = await getPlaylistById(playlist.id).catch(() => null);
      if (fresh) setTracks((fresh.tracks ?? []).map((pt) => pt.track));
    }
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

  if (loading) return <Spinner />;
  if (!playlist) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end gap-6">
        <div className="w-48 h-48 rounded-2xl bg-gradient-to-br from-surface-300 to-surface-200 flex items-center justify-center shrink-0">
          <Music className="w-16 h-16 text-gray-500" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-medium text-vybe-400 mb-2">PLAYLIST</p>
          <h1 className="text-4xl font-bold mb-2">{playlist.name}</h1>
          {playlist.description && (
            <p className="text-gray-400 mb-2">{playlist.description}</p>
          )}
          <p className="text-sm text-gray-500">
            {playlist.user?.username ?? "User"}
            {playlist._count?.tracks ? ` · ${playlist._count.tracks} tracks` : " · 0 tracks"}
          </p>
          <div className="flex gap-3 mt-4">
            {tracks.length > 0 && (
              <Button onClick={() => playQueue(tracks, 0)}>
                <Play className="w-4 h-4 fill-white" /> Play
              </Button>
            )}
            {isOwner && (
              <Button variant="outline" onClick={handleDelete}>
                <Trash2 className="w-4 h-4" /> Delete
              </Button>
            )}
          </div>
        </div>
      </div>

      {tracks.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400">This playlist is empty. Add some tracks!</p>
        </div>
      ) : (
        <div className="space-y-1">
          {isOwner && (
            <p className="text-xs text-gray-500 flex items-center gap-2 mb-2">
              <GripVertical className="w-4 h-4" /> Drag tracks to reorder
            </p>
          )}
          {tracks.map((track, index) => (
            <TrackRow
              key={track.id}
              track={track}
              index={index}
              tracks={tracks}
              draggable={isOwner}
              dragOver={isOwner && overIndex === index && dragIndex !== index}
              onDragStart={handleDragStart(index)}
              onDragOver={handleDragOver(index)}
              onDrop={handleDrop(index)}
              onDragEnd={handleDragEnd}
            />
          ))}
        </div>
      )}
    </div>
  );
}