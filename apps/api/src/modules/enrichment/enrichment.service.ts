import {
  findFullAudio,
  versionsMatch,
  trackVersionKey,
} from "../archive/archive.service.js";
import type { ArchiveTrack } from "../archive/archive.service.js";

// ---------------------------------------------------------------------------
// Full-audio enrichment shared by every route that hands tracks to the
// player. Deezer only serves 30s previews, and the product rule is "only
// complete songs play": tracks that end up without a full-length audioUrl are
// filtered out before the response is sent (see enrichFullOnly).
//
// Phase 1 reuses archive.org results the caller already fetched (free);
// phase 2 looks up the remaining tracks one by one under a hard time budget
// so route latency stays bounded.
// ---------------------------------------------------------------------------

// Tunable per environment. A cloud host with clean network reaches archive.org
// fast, so these can stay generous; a slower link can lower the budget.
const envInt = (name: string, fallback: number): number => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

// Per-track archive lookups are disabled by default: each one fans out to
// several archive.org searches, and a full page of them (30 tracks x 3) got the
// host's IP throttled by archive.org, which broke even the artists the archive
// does have. Full-length audio now comes from the archive *search* results that
// are already in the list (phase 1), so this stays off unless an environment
// opts back in (FULL_AUDIO_LIMIT=N).
export const FULL_AUDIO_LIMIT = envInt("FULL_AUDIO_LIMIT", 0);
export const FULL_AUDIO_BUDGET_MS = envInt("FULL_AUDIO_BUDGET_MS", 12000);

// Any audioUrl works: http(s) for archive/remote streams, a relative path for
// the user's own uploads (played through /tracks/:id/stream). A track with
// only previewUrl would play 30s and stop, so it counts as NOT playable.
export function isFullAudio(track: any): boolean {
  const url = track?.audioUrl;
  return typeof url === "string" && url.trim().length > 0;
}

function phase1FullAudioMatch(
  track: {
    title?: string;
    artist?: { name?: string | null } | null;
    duration?: number | null;
  },
  archiveTracks: ArchiveTrack[]
): ArchiveTrack | null {
  for (const candidate of archiveTracks) {
    const duration = Number(candidate.duration || 0);
    if (duration > 0 && duration < 60) continue;
    // Strict equality: same core title, same version markers
    // (live/acoustic/remix/demo), compatible duration, artist on one side.
    if (
      versionsMatch(track, {
        title: candidate.title,
        artist: candidate.artist,
        duration: candidate.duration,
        context: candidate.album?.title,
      })
    ) {
      return candidate;
    }
  }
  return null;
}

export async function attachFullAudio(
  tracks: any[],
  archiveTracks: ArchiveTrack[] = [],
  sourcesById?: Map<string, number>
): Promise<void> {
  try {
    // source 0 = local DB (plays from /tracks/:id/stream already),
    // source 4 = archive.org results (already full length).
    const candidates = tracks.filter(
      (track) =>
        !isFullAudio(track) &&
        sourcesById?.get(track.id) !== 0 &&
        sourcesById?.get(track.id) !== 4
    );

    for (const track of candidates) {
      const match = phase1FullAudioMatch(track, archiveTracks);
      if (match?.audioUrl) track.audioUrl = match.audioUrl;
    }

    const pending = candidates
      .filter((track) => !isFullAudio(track))
      .slice(0, FULL_AUDIO_LIMIT);
    if (pending.length === 0) return;

    const jobs = pending.map(async (track) => {
      const found = await findFullAudio(
        String(track.title ?? ""),
        track.artist?.name ?? null,
        Number(track.duration || 0)
      );
      if (found?.audioUrl) track.audioUrl = found.audioUrl;
    });

    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        Promise.allSettled(jobs),
        new Promise<void>((resolve) => {
          timer = setTimeout(resolve, FULL_AUDIO_BUDGET_MS);
        }),
      ]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  } catch (error) {
    console.log(
      "[full-audio] enrichment skipped:",
      error instanceof Error ? error.message : error
    );
  }
}

// The product rule: only tracks that play completely are returned. Anything
// still on a 30s preview after enrichment is hidden instead of being handed
// to the player.
export async function enrichFullOnly(
  tracks: any[],
  archiveTracks?: ArchiveTrack[],
  sourcesById?: Map<string, number>
): Promise<any[]> {
  await attachFullAudio(tracks, archiveTracks, sourcesById);
  return tracks.filter(isFullAudio);
}

// Deezer and archive.org routinely return the same song as two rows; without
// this the results list showed 15 "Tempo Perdido" lines and the player queued
// them all. Rows sharing core title + version markers + artist collapse to
// the first occurrence (locals are first, so the user's own file wins).
export function collapseDuplicates(tracks: any[]): any[] {
  const seen = new Map<string, any>();
  const out: any[] = [];
  for (const track of tracks) {
    const key = trackVersionKey(track.title, track.artist?.name);
    if (!key) {
      out.push(track);
      continue;
    }
    const first = seen.get(key);
    if (first) {
      if (!isFullAudio(first) && isFullAudio(track)) {
        first.audioUrl = track.audioUrl;
      }
      continue;
    }
    seen.set(key, track);
    out.push(track);
  }
  return out;
}
