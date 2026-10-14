import { useEffect, useState } from "react";
import type { SearchResults, Track } from "@vybe/shared";
import { useDebounce } from "../hooks/useDebounce";
import { search } from "../services/search";
import { Search as SearchIcon, X } from "lucide-react";

export function ShowcaseSearch({
  onNavigate,
}: {
  onNavigate: (type: string, id: string, track?: Track, queue?: Track[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
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
  }, [debouncedQuery]);

  return (
    <div className="relative">
      <div className="relative">
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search music, artists, albums..."
          className="w-full bg-surface-100 rounded-full pl-11 pr-10 py-2.5 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-vybe-500/50"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setIsOpen(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {isOpen && query && (
        <div className="absolute top-full mt-2 w-full bg-surface-100 rounded-2xl border border-white/10 shadow-xl overflow-hidden z-50">
          {loading && <div className="p-4 text-sm text-gray-400">Searching...</div>}
          {!loading && results && (
            <div className="max-h-96 overflow-y-auto">
              {results.tracks.length > 0 && (
                <div className="p-2">
                  <p className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase">Songs</p>
                  {results.tracks.map((track) => (
                    <button
                      key={track.id}
                      onClick={() => onNavigate("track", track.id, track, results.tracks)}
                      className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-surface-50 text-left"
                    >
                      <span className="w-10 h-10 rounded bg-vybe-600/20 flex items-center justify-center text-vybe-400 font-semibold text-sm shrink-0">
                        {track.title[0]}
                      </span>
                      <span>
                        <span className="block text-sm text-white truncate">{track.title}</span>
                        <span className="block text-xs text-gray-400 truncate">
                          {track.artist?.name}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {results.artists.length > 0 && (
                <div className="p-2 border-t border-white/5">
                  <p className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase">Artists</p>
                  {results.artists.map((artist) => (
                    <button
                      key={artist.id}
                      onClick={() => onNavigate("artist", artist.id)}
                      className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-surface-50 text-left"
                    >
                      <span className="w-10 h-10 rounded-full bg-vybe-600/20 flex items-center justify-center text-vybe-400 font-semibold text-sm shrink-0">
                        {artist.name[0]}
                      </span>
                      <span className="text-sm text-white truncate">{artist.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {results.albums.length > 0 && (
                <div className="p-2 border-t border-white/5">
                  <p className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase">Albums</p>
                  {results.albums.map((album) => (
                    <button
                      key={album.id}
                      onClick={() => onNavigate("album", album.id)}
                      className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-surface-50 text-left"
                    >
                      <span className="w-10 h-10 rounded bg-vybe-600/20 flex items-center justify-center text-vybe-400 font-semibold text-sm shrink-0">
                        {album.title[0]}
                      </span>
                      <span>
                        <span className="block text-sm text-white truncate">{album.title}</span>
                        <span className="block text-xs text-gray-400 truncate">
                          {album.artist?.name}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {results.genres.length > 0 && (
                <div className="p-2 border-t border-white/5">
                  <p className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase">Genres</p>
                  {results.genres.map((genre) => (
                    <button
                      key={genre.id}
                      onClick={() => onNavigate("genre", genre.id)}
                      className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-surface-50 text-left"
                    >
                      <span className="text-sm text-white">{genre.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {results.tracks.length === 0 &&
                results.artists.length === 0 &&
                results.albums.length === 0 &&
                results.genres.length === 0 && (
                  <div className="p-4 text-sm text-gray-400">No results for "{query}"</div>
                )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}