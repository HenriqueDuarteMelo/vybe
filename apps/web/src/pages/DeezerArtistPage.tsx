import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { Track } from "@vybe/shared";
import { discoverArtist } from "../services/discover";
import { usePlayerStore } from "../stores/playerStore";
import { TrackRow } from "../components/music/TrackRow";
import { Spinner } from "../components/ui/Spinner";
import { Button } from "../components/ui/Button";
import { Play, Music, Users, Disc3 } from "lucide-react";

export function DeezerArtistPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<{
    artist: { id: string; name: string; imageUrl: string | null; _count: { albums: number } };
    topTracks: Track[];
    albums: Array<{ id: string; title: string; coverUrl: string | null; _count: { tracks: number } }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const playQueue = usePlayerStore((state) => state.playQueue);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    discoverArtist(id)
      .then(setData)
      .catch((err) => setError(err.message || "Failed to load artist"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Spinner />;
  if (error) return <div className="text-center py-12 text-red-400">{error}</div>;
  if (!data) return null;

  const { artist, topTracks, albums } = data;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end gap-6">
        {artist.imageUrl ? (
          <img
            src={artist.imageUrl}
            alt={artist.name}
            className="w-48 h-48 rounded-2xl object-cover shrink-0"
          />
        ) : (
          <div className="w-48 h-48 rounded-2xl bg-gradient-to-br from-vybe-600/30 to-surface-200 flex items-center justify-center shrink-0">
            <Music className="w-16 h-16 text-gray-500" />
          </div>
        )}
        <div className="flex-1">
          <p className="text-xs font-medium text-vybe-400 mb-2">ARTIST</p>
          <h1 className="text-4xl font-bold mb-2">{artist.name}</h1>
          <div className="flex gap-4 text-sm text-gray-400">
            <span className="flex items-center gap-1">
              <Disc3 className="w-4 h-4" /> {artist._count.albums} albums
            </span>
          </div>
          <div className="flex gap-3 mt-4">
            {topTracks.length > 0 && (
              <Button onClick={() => playQueue(topTracks, 0)}>
                <Play className="w-4 h-4 fill-white" /> Play
              </Button>
            )}
          </div>
        </div>
      </div>

      <section>
        <h2 className="text-xl font-semibold mb-4">Top tracks</h2>
        {topTracks.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400">No full tracks available</p>
          </div>
        ) : (
          <div className="space-y-1">
            {topTracks.slice(0, 10).map((track, index) => (
              <TrackRow
                key={track.id}
                track={track}
                index={index}
                tracks={topTracks}
                showAlbum={true}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Discography</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {albums.map((album) => (
            <button
              key={album.id}
              onClick={() => navigate(`/deezer/album/${album.id}`)}
              className="text-left group"
            >
              {album.coverUrl ? (
                <img
                  src={album.coverUrl}
                  alt={album.title}
                  className="w-full aspect-square rounded-xl object-cover mb-2 group-hover:ring-2 ring-vybe-500/50"
                />
              ) : (
                <div className="w-full aspect-square rounded-xl bg-surface-300 flex items-center justify-center mb-2 group-hover:ring-2 ring-vybe-500/50">
                  <Music className="w-10 h-10 text-gray-500" />
                </div>
              )}
              <p className="text-sm font-medium text-white truncate">{album.title}</p>
              <p className="text-xs text-gray-400">{album._count.tracks} tracks</p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}