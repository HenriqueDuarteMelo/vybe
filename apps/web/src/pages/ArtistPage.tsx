import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { Artist, Track } from "@vybe/shared";
import { getArtistById, getArtistTopTracks } from "../services/artists";
import { usePlayerStore } from "../stores/playerStore";
import { TrackRow } from "../components/music/TrackRow";
import { AlbumCard } from "../components/music/AlbumCard";
import { Spinner } from "../components/ui/Spinner";
import { Button } from "../components/ui/Button";
import { Play, Heart, Disc3 } from "lucide-react";

export function ArtistPage() {
  const { id } = useParams<{ id: string }>();
  const [artist, setArtist] = useState<Artist | null>(null);
  const [topTracks, setTopTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const playQueue = usePlayerStore((state) => state.playQueue);

  useEffect(() => {
    if (!id) return;
    Promise.all([getArtistById(id), getArtistTopTracks(id, 10)])
      .then(([artistData, top]) => {
        setArtist(artistData);
        setTopTracks(top);
      })
      .catch((err) => console.error("Failed to load artist", err))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Spinner />;
  if (!artist) return null;

  const albums = (artist as unknown as { albums?: Array<{ id: string; title: string; coverUrl: string | null; releaseYear: number | null; artistId: string; _count?: { tracks: number } }> }).albums ?? [];

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-end gap-6">
        <div className="w-48 h-48 rounded-full bg-gradient-to-br from-vybe-600/40 to-surface-300 flex items-center justify-center shrink-0 border border-white/10">
          <span className="text-6xl font-bold text-vybe-500/50">{artist.name[0]}</span>
        </div>
        <div className="flex-1">
          <p className="text-xs font-medium text-vybe-400 mb-2">ARTIST</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-2">{artist.name}</h1>
          {artist.bio && <p className="text-gray-400 max-w-2xl">{artist.bio}</p>}
          <div className="flex gap-3 mt-4">
            {topTracks.length > 0 && (
              <Button onClick={() => playQueue(topTracks, 0)}>
                <Play className="w-4 h-4 fill-white" /> Play
              </Button>
            )}
          </div>
        </div>
      </div>

      {topTracks.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
            <Heart className="w-5 h-5 text-vybe-500" />
            Popular
          </h2>
          <div className="space-y-1">
            {topTracks.map((track, index) => (
              <TrackRow key={track.id} track={track} index={index} tracks={topTracks} showAlbum />
            ))}
          </div>
        </section>
      )}

      {albums.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
            <Disc3 className="w-5 h-5 text-vybe-500" />
            Albums
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {albums.map((album) => (
              <AlbumCard key={album.id} album={album} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}