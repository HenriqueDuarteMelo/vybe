import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import type { SearchResults, Track } from "@vybe/shared";
import { useDebounce } from "../hooks/useDebounce";
import { search } from "../services/search";
import { getTracks } from "../services/tracks";
import { usePlayerStore } from "../stores/playerStore";
import { TrackRow } from "../components/music/TrackRow";
import { AlbumCard } from "../components/music/AlbumCard";
import { ArtistCard } from "../components/music/ArtistCard";
import { Spinner } from "../components/ui/Spinner";
import { Search as SearchIcon } from "lucide-react";

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const initialQuery = params.get("q") ?? "";
  const genreId = params.get("genre");

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [genreTracks, setGenreTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 350);

  const playQueue = usePlayerStore((state) => state.playQueue);
  const playTrack = usePlayerStore((state) => state.playTrack);

  useEffect(() => {
    if (genreId) {
      setLoading(true);
      getTracks({ genreId, limit: 50 })
        .then((res) => setGenreTracks(res.tracks ?? []))
        .catch(() => setGenreTracks([]))
        .finally(() => setLoading(false));
      return;
    }

    if (!debouncedQuery.trim()) {
      setResults(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    search(debouncedQuery)
      .then(setResults)
      .catch(() =>
        setResults({ top: null, tracks: [], artists: [], albums: [], genres: [] })
      )
      .finally(() => setLoading(false));
  }, [debouncedQuery, genreId]);

  const updateQuery = (value: string) => {
    setQuery(value);
    if (value.trim()) {
      setParams({ q: value });
    } else {
      setParams({});
    }
  };

  const navigateTo = (type: string, id: string) => {
    if (type === "track") {
      // handled by TrackRow play
    } else if (type === "artist") {
      const path = id.startsWith("deezer:") ? "/deezer/artist" : "/artist";
      navigate(`${path}/${id}`);
    } else if (type === "album") {
      const path = id.startsWith("deezer:") ? "/deezer/album" : "/album";
      navigate(`${path}/${id}`);
    }
  };

  return (
    <div className="space-y-8">
      <div className="relative max-w-2xl">
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => updateQuery(e.target.value)}
          placeholder="Search songs, artists, albums, genres..."
          autoFocus
          className="w-full bg-surface-100 rounded-full pl-12 pr-6 py-3.5 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-vybe-500/50"
        />
      </div>

      {loading ? (
        <Spinner />
      ) : genreId ? (
        <div className="space-y-1">
          <h2 className="text-xl font-semibold mb-4">Genre tracks</h2>
          {genreTracks.length === 0 ? (
            <p className="text-gray-400">No tracks in this genre yet.</p>
          ) : (
            genreTracks.map((track, index) => (
              <TrackRow
                key={track.id}
                track={track}
                index={index}
                tracks={genreTracks}
              />
            ))
          )}
          {genreTracks.length > 0 && (
            <button
              onClick={() => playQueue(genreTracks, 0)}
              className="mt-4 px-5 py-2 rounded-full bg-vybe-600 text-white text-sm font-medium hover:bg-vybe-500"
            >
              Play all
            </button>
          )}
        </div>
      ) : !query.trim() ? (
        <div className="text-center py-16">
          <SearchIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl text-gray-400">Search the VYBE catalog</h2>
          <p className="text-sm text-gray-500 mt-1">
            Find songs, artists, albums and genres
          </p>
        </div>
      ) : !results ? (
        <p className="text-gray-400">Searching...</p>
      ) : (
        <div className="space-y-8">
          {results.top && (
            <section>
              <h2 className="text-xl font-semibold mb-3">Top result</h2>
              <button
                onClick={() => {
                  if (results.top!.type === "artist" || results.top!.type === "album") {
                    navigateTo(results.top!.type, results.top!.id);
                  } else if (results.top!.type === "track") {
                    const match = results.tracks.find((t) => t.id === results.top!.id);
                    if (match) playTrack(match, results.tracks, results.tracks.indexOf(match));
                  } else if (results.top!.type === "genre") {
                    setParams({ genre: results.top!.id });
                  }
                }}
                className="w-full max-w-sm text-left p-5 rounded-2xl bg-gradient-to-br from-vybe-600/30 to-surface-100 border border-white/10 hover:border-vybe-500/50 transition-colors"
              >
                <span className="w-16 h-16 rounded-full bg-vybe-600/30 flex items-center justify-center text-2xl font-bold text-vybe-300 mb-4">
                  {results.top.name[0]}
                </span>
                <span className="block text-lg font-bold text-white truncate">{results.top.name}</span>
                <span className="block text-sm text-vybe-400 capitalize mt-0.5">{results.top.type}</span>
              </button>
            </section>
          )}

          {results.tracks.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold mb-3">Songs</h2>
              <div className="space-y-1">
                {results.tracks.map((track, index) => (
                  <TrackRow key={track.id} track={track} index={index} tracks={results.tracks} />
                ))}
              </div>
            </section>
          )}

          {results.artists.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold mb-3">Artists</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {results.artists.map((artist) => (
                  <ArtistCard
                    key={artist.id}
                    artist={artist}
                    href={artist.id.startsWith("deezer:") ? `/deezer/artist/${artist.id}` : undefined}
                  />
                ))}
              </div>
            </section>
          )}

          {results.albums.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold mb-3">Albums</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {results.albums.map((album) => (
                  <AlbumCard
                    key={album.id}
                    album={album}
                    href={album.id.startsWith("deezer:") ? `/deezer/album/${album.id}` : undefined}
                  />
                ))}
              </div>
            </section>
          )}

          {results.genres.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold mb-3">Genres</h2>
              <div className="flex flex-wrap gap-2">
                {results.genres.map((genre) => (
                  <button
                    key={genre.id}
                    onClick={() => setParams({ genre: genre.id })}
                    className="px-4 py-2 rounded-full bg-surface-50 border border-white/10 text-sm text-gray-300 hover:text-white hover:border-vybe-500"
                  >
                    {genre.name}
                  </button>
                ))}
              </div>
            </section>
          )}

          {results.tracks.length === 0 &&
            results.artists.length === 0 &&
            results.albums.length === 0 &&
            results.genres.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-400">No results found for "{query}"</p>
                <button
                  onClick={() => navigateTo("artist", "")}
                  className="hidden"
                >
                  hidden
                </button>
              </div>
            )}
        </div>
      )}
    </div>
  );
}