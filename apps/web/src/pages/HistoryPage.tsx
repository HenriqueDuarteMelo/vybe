import { useEffect, useState } from "react";
import type { ListeningHistoryEntry } from "@vybe/shared";
import { getHistory, type ListeningHistoryResponse } from "../services/history";
import { usePlayerStore } from "../stores/playerStore";
import { TrackRow } from "../components/music/TrackRow";
import { Spinner } from "../components/ui/Spinner";
import { Button } from "../components/ui/Button";
import { Play, History as HistoryIcon } from "lucide-react";

export function HistoryPage() {
  const [history, setHistory] = useState<ListeningHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const playQueue = usePlayerStore((state) => state.playQueue);

  useEffect(() => {
    getHistory()
      .then((res: ListeningHistoryResponse) => {
        setHistory(res.history ?? []);
      })
      .catch((err) => console.error("Failed to load history", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  const tracks = history.map((h) => h.track);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <HistoryIcon className="w-7 h-7 text-vybe-500" />
            Listening History
          </h1>
          <p className="text-gray-400 mt-1">Tracks you've played recently</p>
        </div>
        {tracks.length > 0 && (
          <Button onClick={() => playQueue(tracks, 0)}>
            <Play className="w-4 h-4 fill-white" /> Play all
          </Button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="text-center py-16 bg-surface-50 rounded-2xl border border-white/5">
          <HistoryIcon className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">No listening history yet. Play some music!</p>
        </div>
      ) : (
        <div className="space-y-1">
          {history.map((entry, index) => (
            <TrackRow
              key={entry.id}
              track={entry.track}
              index={index}
              tracks={tracks}
            />
          ))}
        </div>
      )}
    </div>
  );
}