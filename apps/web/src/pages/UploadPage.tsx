import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Artist, Album, Genre, Track } from "@vybe/shared";
import { getArtists } from "../services/artists";
import { getAlbums } from "../services/albums";
import { getGenres } from "../services/genres";
import { uploadTrack } from "../services/tracks";
import { Spinner } from "../components/ui/Spinner";
import { Button } from "../components/ui/Button";
import { UploadCloud, Check, X } from "lucide-react";

function detectAudioDuration(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(audio.duration) ? Math.round(audio.duration) : undefined);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(undefined);
    };
    audio.src = url;
  });
}

export function UploadPage() {
  const navigate = useNavigate();
  const [artists, setArtists] = useState<Artist[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [loading, setLoading] = useState(true);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [artistId, setArtistId] = useState("");
  const [albumId, setAlbumId] = useState("");
  const [genreIds, setGenreIds] = useState<string[]>([]);
  const [trackNumber, setTrackNumber] = useState("");
  const [duration, setDuration] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Track | null>(null);

  useEffect(() => {
    Promise.all([getArtists({ limit: 200 }), getAlbums({ limit: 200 }), getGenres()])
      .then(([artistRes, albumRes, genreRes]) => {
        setArtists(artistRes.data ?? []);
        setAlbums(albumRes.data ?? []);
        setGenres(genreRes);
      })
      .catch((err) => setError(err.message || "Failed to load catalog"))
      .finally(() => setLoading(false));
  }, []);

  const filteredAlbums = artistId ? albums.filter((a) => a.artistId === artistId) : albums;

  const handleFile = async (selected: File | null) => {
    setFile(selected);
    setDone(null);
    if (selected) {
      const detected = await detectAudioDuration(selected);
      if (detected) setDuration(String(detected));
    }
  };

  const toggleGenre = (id: string) => {
    setGenreIds((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Select an audio file");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("audio", file);
      form.append("title", title.trim());
      form.append("artistId", artistId);
      form.append("albumId", albumId);
      if (genreIds.length) form.append("genreIds", JSON.stringify(genreIds));
      if (trackNumber) form.append("trackNumber", trackNumber);
      if (duration) form.append("duration", duration);
      const track = await uploadTrack(form);
      setDone(track);
      setTitle("");
      setFile(null);
      setDuration("");
      setTrackNumber("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Spinner />;
  if (done) {
    return (
      <div className="max-w-xl mx-auto text-center py-16 space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-vybe-600/20 flex items-center justify-center">
          <Check className="w-8 h-8 text-vybe-400" />
        </div>
        <h1 className="text-2xl font-bold">Track uploaded</h1>
        <p className="text-gray-400">
          "{done.title}" by {done.artist?.name} is now in the catalog.
        </p>
        <div className="flex justify-center gap-3">
          <Button onClick={() => setDone(null)}>Upload another</Button>
          <Button variant="outline" onClick={() => navigate("/")}>
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <p className="text-xs font-medium text-vybe-400 mb-2">UPLOAD</p>
        <h1 className="text-3xl font-bold">Add a track to VYBE</h1>
        <p className="text-gray-400 mt-1 text-sm">
          Upload an audio file you own and add it to the catalog.
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <label className="block">
          <span className="text-sm font-medium text-gray-300 mb-2 block">Audio file</span>
          <div className="relative border-2 border-dashed border-surface-50 rounded-xl px-6 py-8 text-center hover:border-vybe-500/50 transition-colors cursor-pointer">
            <input
              type="file"
              accept="audio/*"
              className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <Check className="w-5 h-5 text-vybe-400" />
                <span className="text-sm text-white">{file.name}</span>
                <button
                  type="button"
                  onClick={() => handleFile(null)}
                  className="text-gray-500 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div>
                <UploadCloud className="w-10 h-10 text-gray-500 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Click to choose an audio file (max 50 MB)</p>
              </div>
            )}
          </div>
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-300 mb-2 block">Title</span>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-surface-100 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-vybe-500/50"
              placeholder="Track title"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-300 mb-2 block">Artist</span>
            <select
              required
              value={artistId}
              onChange={(e) => {
                setArtistId(e.target.value);
                setAlbumId("");
              }}
              className="w-full bg-surface-100 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-vybe-500/50"
            >
              <option value="" disabled>
                Select artist
              </option>
              {artists.map((artist) => (
                <option key={artist.id} value={artist.id} className="bg-surface-200">
                  {artist.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-300 mb-2 block">Album</span>
            <select
              required
              value={albumId}
              onChange={(e) => setAlbumId(e.target.value)}
              className="w-full bg-surface-100 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-vybe-500/50"
            >
              <option value="" disabled>
                {artistId ? "Select album" : "Select an artist first"}
              </option>
              {filteredAlbums.map((album) => (
                <option key={album.id} value={album.id} className="bg-surface-200">
                  {album.title}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-300 mb-2 block">Track number</span>
              <input
                type="number"
                min={1}
                value={trackNumber}
                onChange={(e) => setTrackNumber(e.target.value)}
                className="w-full bg-surface-100 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-vybe-500/50"
                placeholder="#"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-300 mb-2 block">Duration (s)</span>
              <input
                type="number"
                min={1}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full bg-surface-100 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-vybe-500/50"
                placeholder="auto"
              />
            </label>
          </div>
        </div>

        <div>
          <span className="text-sm font-medium text-gray-300 mb-2 block">Genres</span>
          <div className="flex flex-wrap gap-2">
            {genres.map((genre) => {
              const active = genreIds.includes(genre.id);
              return (
                <button
                  key={genre.id}
                  type="button"
                  onClick={() => toggleGenre(genre.id)}
                  className={`px-4 py-2 rounded-full border text-sm transition-colors ${
                    active
                      ? "border-vybe-500 bg-vybe-600/20 text-vybe-300"
                      : "border-white/10 text-gray-400 hover:border-white/30 hover:text-white"
                  }`}
                >
                  {genre.name}
                </button>
              );
            })}
          </div>
        </div>

        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Uploading..." : "Upload track"}
        </Button>
      </form>
    </div>
  );
}