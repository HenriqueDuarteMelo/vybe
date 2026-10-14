import { create } from "zustand";
import type { RepeatMode, Track } from "@vybe/shared";
import { api } from "../services/api.js";
import { recordListening } from "../services/history.js";

type RepeatState = "off" | "all" | "one";

interface PlayerState {
  currentTrack: Track | null;
  queue: Track[];
  queueIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  shuffle: boolean;
  repeat: RepeatState;
  loading: boolean;
  error: string | null;
  source: string | null;

  play: (tracks: Track[], index?: number) => void;
  toggle: () => void;
  playTrack: (track: Track, tracks: Track[], index: number) => void;
  playQueue: (tracks: Track[], index?: number) => void;
  togglePlay: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  next: () => void;
  prev: () => void;
  seek: (time: number) => void;
  setVolume: (vol: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  stop: () => void;
}

function getAudioElement(): HTMLAudioElement {
  const id = "vybe-player-audio";
  let el = document.querySelector<HTMLAudioElement>(`#${id}`);
  if (!el) {
    el = document.createElement("audio");
    el.id = id;
    el.preload = "auto";
    el.style.display = "none";
    document.body.appendChild(el);
  }
  return el;
}

const EXTERNAL = (u?: string | null): string | null =>
  u && u.startsWith("http") ? u : null;

function resolveAudioSrc(track: Track): string {
  const ext = EXTERNAL(track.audioUrl) ?? EXTERNAL(track.previewUrl);
  if (ext) return api.getProxyStreamUrl(ext);
  return api.getStreamUrl(track.id);
}

const STALL_MS = 8000;
const LOADING_STALL_MS = 20000;
const MAX_RECOVERY_ATTEMPTS = 5;

let stallTimer: ReturnType<typeof setInterval> | null = null;
let lastTickAt = 0;
let lastTime = 0;
let maxTickedTime = 0;
let recoveryAttempts = 0;
let recovering = false;

function stopStallWatchdog() {
  if (stallTimer !== null) {
    clearInterval(stallTimer);
    stallTimer = null;
  }
}

function withCacheBuster(url: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}cache_bust=${Date.now()}`;
}

// Mid-track audio that comes from the external proxy sometimes gets cut by
// network middleboxes after ~4MB per connection. Detect when playback freezes
// (no progress while playing) and recover with a fresh Range-capable request
// that resumes from the frozen position, so longer songs play to the end.
async function recoverPlayback(trackId: string): Promise<void> {
  const audio = getAudioElement();
  const s = usePlayerStore.getState();
  if (!s.currentTrack || s.currentTrack.id !== trackId) return;
  if (!audio.getAttribute("src")) return;

  recoveryAttempts += 1;
  if (recoveryAttempts > MAX_RECOVERY_ATTEMPTS) {
    stopStallWatchdog();
    usePlayerStore.setState({
      isPlaying: false,
      loading: false,
      error: "A reprodução travou e não foi possível continuar.",
    });
    return;
  }

  const resumeAt = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
  const src = withCacheBuster(audio.src);

  const onReady = () => {
    const cur = usePlayerStore.getState();
    if (!cur.currentTrack || cur.currentTrack.id !== trackId) return;
    if (resumeAt > 0) {
      try {
        audio.currentTime = resumeAt;
      } catch {
        // ignore: some containers do not allow seeking before metadata
      }
    }
    audio.play().catch(() => {});
    lastTime = audio.currentTime;
    lastTickAt = Date.now();
  };

  audio.addEventListener("loadedmetadata", onReady, { once: true });
  audio.src = src;
  audio.load();
}

function startStallWatchdog(trackId: string) {
  stopStallWatchdog();
  const audio = getAudioElement();
  lastTickAt = Date.now();
  lastTime = audio.currentTime;
  maxTickedTime = audio.currentTime;
  recoveryAttempts = 0;
  recovering = false;

  stallTimer = setInterval(() => {
    const s = usePlayerStore.getState();
    if (!s.currentTrack || s.currentTrack.id !== trackId) {
      stopStallWatchdog();
      return;
    }
    if (recovering) return;

    const t = audio.currentTime;
    if (audio.paused || !s.isPlaying) {
      lastTime = t;
      lastTickAt = Date.now();
      return;
    }

    if (Number.isFinite(t)) {
      if (t > maxTickedTime + 0.5) {
        maxTickedTime = t;
        recoveryAttempts = 0;
      }
      if (t !== lastTime) {
        lastTime = t;
        lastTickAt = Date.now();
        return;
      }
      if (Date.now() - lastTickAt >= STALL_MS) {
        recovering = true;
        recoverPlayback(trackId).finally(() => {
          recovering = false;
        });
        lastTickAt = Date.now();
      }
      return;
    }

    if (s.loading && Date.now() - lastTickAt >= LOADING_STALL_MS) {
      recovering = true;
      recoverPlayback(trackId).finally(() => {
        recovering = false;
      });
      lastTickAt = Date.now();
    }
  }, 2000);
}

function wireAudioEvents(audio: HTMLAudioElement, onEnded: () => void) {
  audio.ontimeupdate = () => {
    usePlayerStore.setState({ currentTime: audio.currentTime });
  };

  audio.onloadedmetadata = () => {
    usePlayerStore.setState({
      duration: Number.isFinite(audio.duration) ? audio.duration : 0,
      loading: false,
    });
  };

  audio.onplay = () => usePlayerStore.setState({ isPlaying: true });
  audio.onpause = () => usePlayerStore.setState({ isPlaying: false });

  audio.onerror = () => {
    const s = usePlayerStore.getState();
    const hasSrc = !!audio.getAttribute("src");
    if (hasSrc && s.currentTrack && recoveryAttempts < MAX_RECOVERY_ATTEMPTS) {
      const trackId = s.currentTrack.id;
      lastTime = audio.currentTime;
      lastTickAt = Date.now();
      recoverPlayback(trackId).catch(() => {});
      return;
    }
    stopStallWatchdog();
    const err = audio.error?.message || "unknown";
    usePlayerStore.setState({ isPlaying: false, error: err, loading: false });
  };

  audio.onended = () => onEnded();
}

async function beginPlayback(
  track: Track,
  queue: Track[],
  queueIndex: number,
  source?: string | null
) {
  const audio = getAudioElement();
  const src = resolveAudioSrc(track);

  const onEnded = () => {
    const s = usePlayerStore.getState();
    if (s.repeat === "one") {
      audio.currentTime = 0;
      audio.play().catch(() => {});
      return;
    }
    s.next();
  };

  wireAudioEvents(audio, onEnded);

  usePlayerStore.setState({
    currentTrack: track,
    queue,
    queueIndex,
    isPlaying: true,
    currentTime: 0,
    duration: Number.isFinite(track.duration) ? track.duration : 0,
    loading: true,
    error: null,
    ...(source !== undefined ? { source } : {}),
  });

  const onReady = () => {
    audio.play().catch((e) => {
      console.error("vybe: autoplay blocked", e);
      usePlayerStore.setState({ isPlaying: false, loading: false });
    });
  };

  audio.oncanplay = onReady;

  audio.src = src;
  audio.load();

  startStallWatchdog(track.id);
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  queue: [],
  queueIndex: 0,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.8,
  shuffle: false,
  repeat: "off",
  loading: false,
  error: null,
  source: null,

  play: (tracks, index = 0) => {
    const audio = getAudioElement();
    audio.pause();
    const start = index < 0 || index >= tracks.length ? 0 : index;
    beginPlayback(tracks[start], tracks, start, `${window.location.pathname}${window.location.search}`);
  },

  toggle: () => {
    const s = get();
    const audio = getAudioElement();
    if (audio.paused) {
      audio.play().catch(() => {});
      set({ isPlaying: true });
    } else {
      audio.pause();
      set({ isPlaying: false });
    }
  },

  playTrack: (track, tracks, index) => {
    const safe = tracks && tracks.length ? tracks : [track];
    get().play(safe, index >= 0 && index < safe.length ? index : 0);
  },

  playQueue: (tracks, index = 0) => {
    get().play(tracks, index);
  },

  togglePlay: () => {
    get().toggle();
  },

  nextTrack: () => {
    get().next();
  },

  prevTrack: () => {
    get().prev();
  },

  removeFromQueue: (index) => {
    const s = get();
    if (index < 0 || index >= s.queue.length) return;
    set({ queue: s.queue.filter((_, i) => i !== index) });
  },

  clearQueue: () => {
    get().stop();
  },

  next: () => {
    const s = get();
    if (s.queue.length === 0) return;
    if (s.repeat === "one") {
      const audio = getAudioElement();
      audio.currentTime = 0;
      audio.play().catch(() => {});
      return;
    }
    let idx = s.queueIndex + 1;
    if (idx >= s.queue.length) {
      if (s.repeat === "all") idx = 0;
      else {
        set({ isPlaying: false });
        return;
      }
    }
    if (s.shuffle) {
      idx = Math.floor(Math.random() * s.queue.length);
    }
    beginPlayback(s.queue[idx], s.queue, idx);
  },

  prev: () => {
    const s = get();
    if (s.queue.length === 0) return;
    if (s.repeat === "one") {
      const audio = getAudioElement();
      audio.currentTime = 0;
      audio.play().catch(() => {});
      return;
    }
    let idx = s.queueIndex - 1;
    if (idx < 0) {
      if (s.repeat === "all") idx = s.queue.length - 1;
      else idx = 0;
    }
    if (s.shuffle) {
      idx = Math.floor(Math.random() * s.queue.length);
    }
    beginPlayback(s.queue[idx], s.queue, idx);
  },

  seek: (t) => {
    const audio = getAudioElement();
    if (Number.isFinite(t)) audio.currentTime = Math.max(0, t);
    set({ currentTime: audio.currentTime });
  },

  setVolume: (v) => {
    const vol = Math.min(1, Math.max(0, v));
    getAudioElement().volume = vol;
    set({ volume: vol });
  },

  toggleShuffle: () => set({ shuffle: !get().shuffle }),
  cycleRepeat: () =>
    set({
      repeat:
        get().repeat === "off"
          ? "all"
          : get().repeat === "all"
          ? "one"
          : "off",
    }),

  stop: () => {
    const audio = getAudioElement();
    stopStallWatchdog();
    recoveryAttempts = 0;
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    set({ currentTrack: null, isPlaying: false, queue: [], queueIndex: 0, source: null });
  },
}));
