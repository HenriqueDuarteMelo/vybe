import { useEffect, useState } from "react";
import type { Track } from "@vybe/shared";
import { api } from "../services/api";
import { usePlayerStore } from "../stores/playerStore";
import { TrackRow } from "../components/music/TrackRow";
import { Spinner } from "../components/ui/Spinner";
import { Radio, HelpCircle } from "lucide-react";

export function FreeMusicPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const playQueue = usePlayerStore((state) => state.playQueue);

  useEffect(() => {
    api
      .get<Track[]>("/remote/catalog")
      .then(setTracks)
      .catch(() => setTracks([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Free music</h1>
          <p className="text-gray-400 mt-1 max-w-2xl">
            Stream real songs directly from a CDN that this network allows — no
            downloads on your machine.
          </p>
        </div>
        {tracks.length > 0 && (
          <button
            onClick={() => playQueue(tracks, 0)}
            className="shrink-0 px-5 py-2 rounded-full bg-vybe-600 text-white text-sm font-medium hover:bg-vybe-500"
          >
            Play all
          </button>
        )}
      </div>

      {loading ? (
        <Spinner />
      ) : tracks.length === 0 ? (
        <div className="text-center py-16 bg-surface-50 border border-white/10 rounded-2xl">
          <Radio className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">No free music available right now.</p>
          <p className="text-sm text-gray-500 mt-1">
            Check the API is running, or type "SoundHelix" in search.
          </p>
        </div>
      ) : (
        <>
          <div
            className="flex items-center gap-2 text-xs text-gray-500 bg-surface-50 border border-white/10 rounded-lg px-4 py-3"
          >
            <HelpCircle className="w-4 h-4 shrink-0" />
            These tracks are streamed from an allowed CDN (no download) and are
            provided free for testing. For your own collection, use the Upload page.
          </div>
          <div className="space-y-1">
            {tracks.map((track, index) => (
              <TrackRow key={track.id} track={track} index={index} tracks={tracks} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}