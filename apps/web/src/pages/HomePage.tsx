import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type {
  Track,
  Album,
  Artist,
  Genre,
  PaginatedResponse,
} from "@vybe/shared";
import { getTracks } from "../services/tracks";
import { getAlbums } from "../services/albums";
import { getArtists } from "../services/artists";
import { usePlayerStore } from "../stores/playerStore";
import { TrackRow } from "../components/music/TrackRow";
import { AlbumCard } from "../components/music/AlbumCard";
import { ArtistCard } from "../components/music/ArtistCard";
import { Spinner } from "../components/ui/Spinner";
import { Play, TrendingUp, Flame, Sparkles } from "lucide-react";

export function HomePage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [loading, setLoading] = useState(true);
  const playQueue = usePlayerStore((state) => state.playQueue);

  useEffect(() => {
    Promise.all([
      getTracks({ limit: 10 }),
      getAlbums({ limit: 8 }),
      getArtists({ limit: 8 }),
      fetch("/api/genres").then((r) => r.json()),
    ])
      .then(([trackRes, albumRes, artistRes, genreList]: [
        PaginatedResponse<Track>,
        PaginatedResponse<Album>,
        PaginatedResponse<Artist>,
        Genre[]
      ]) => {
        setTracks(trackRes.tracks ?? []);
        setAlbums(albumRes.albums ?? []);
        setArtists(artistRes.artists ?? []);
        setGenres(genreList);
      })
      .catch((err) => console.error("Failed to load home", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  return (
    <div className="space-y-10 pb-8">
      <section className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-vybe-600/40 via-surface-200 to-surface p-10">
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-vybe-600/20 rounded-full blur-3xl" />
        <div className="relative">
          <p className="inline-flex items-center gap-2 text-vybe-400 text-sm font-medium mb-3">
            <Sparkles className="w-4 h-4" />
            Welcome to VYBE
          </p>
          <h1 className="text-4xl md:text-5xl font-bold text-white">
            Music that <span className="text-gradient">moves you</span>.
          </h1>
          <p className="text-gray-300 mt-3 max-w-lg text-lg">
            Discover trending tracks, explore new artists, and build your perfect playlist.
          </p>
          <button
            onClick={() => {
              if (tracks.length > 0) playQueue(tracks, 0);
            }}
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white hover:bg-vybe-500 text-black font-medium transition-colors"
          >
            <Play className="w-5 h-5 fill-black" />
            Play top tracks
          </button>
        </div>
      </section>

      <section className="md:hidden">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {genres.map((genre) => (
            <Link
              key={genre.id}
              to={`/search?genre=${genre.id}`}
              className="px-4 py-1.5 rounded-full bg-surface-50 border border-white/10 text-sm text-gray-300 hover:text-white hover:border-vybe-500 whitespace-nowrap"
            >
              {genre.name}
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-vybe-500" />
          <h2 className="text-xl font-semibold">Trending Now</h2>
        </div>
        <div className="space-y-1">
          {tracks.map((track, index) => (
            <TrackRow
              key={track.id}
              track={track}
              index={index}
              tracks={tracks}
              showAlbum={false}
            />
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <Flame className="w-5 h-5 text-vybe-500" />
          <h2 className="text-xl font-semibold">New Albums</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-4">
          {albums.map((album) => (
            <AlbumCard key={album.id} album={album} />
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-vybe-500" />
          <h2 className="text-xl font-semibold">Featured Artists</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {artists.map((artist) => (
            <ArtistCard key={artist.id} artist={artist} />
          ))}
        </div>
      </section>

      <section className="hidden md:block">
        <h2 className="text-xl font-semibold mb-4">Browse Genres</h2>
        <div className="flex flex-wrap gap-2">
          {genres.map((genre) => (
            <Link
              key={genre.id}
              to={`/search?genre=${genre.id}`}
              className="px-4 py-2 rounded-full bg-surface-50 border border-white/10 text-sm text-gray-300 hover:text-white hover:border-vybe-500 transition-colors"
            >
              {genre.name}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}