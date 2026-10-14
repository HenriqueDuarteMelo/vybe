interface YoutubeHandlers {
  onTime?: (seconds: number) => void;
  onDuration?: (seconds: number) => void;
  onState?: (state: number) => void;
  onError?: (code: number) => void;
}

interface YtPlayerInstance {
  loadVideoById: (id: string) => void;
  cueVideoById: (id: string) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setVolume: (percent: number) => void;
  getVolume: () => number | void;
  mute: () => void;
  unMute: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  destroy: () => void;
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        id: string,
        options: Record<string, unknown>
      ) => YtPlayerInstance;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let player: YtPlayerInstance | null = null;
let apiLoadPromise: Promise<void> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let handlers: YoutubeHandlers = {};
let volume = 0.7;

function startPolling() {
  stopPolling();
  pollTimer = setInterval(() => {
    if (!player) return;
    const t = player.getCurrentTime();
    if (Number.isFinite(t)) {
      handlers.onTime?.(t);
      const d = player.getDuration();
      if (d > 0) handlers.onDuration?.(d);
    }
  }, 400);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function ensureContainer() {
  let container = document.getElementById("youtube-player-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "youtube-player-container";
    container.style.position = "absolute";
    container.style.left = "-9999px";
    container.style.top = "0";
    container.style.width = "300px";
    container.style.height = "300px";
    container.style.opacity = "0.01";
    container.style.pointerEvents = "none";
    document.body.appendChild(container);
  }
  return container;
}

function loadIframeApi(): Promise<void> {
  if (apiLoadPromise) return apiLoadPromise;
  apiLoadPromise = new Promise<void>((resolve) => {
    if (window.YT?.Player) {
      resolve();
      return;
    }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
  return apiLoadPromise;
}

function createPlayer(extraVars: Record<string, unknown> = {}) {
  ensureContainer();
  player = new window.YT!.Player("youtube-player-container", {
    width: "300",
    height: "300",
    playerVars: {
      autoplay: 1,
      controls: 0,
      disablekb: 1,
      playsinline: 1,
      rel: 0,
      iv_load_policy: 3,
      modestbranding: 1,
      mute: 1,
      ...extraVars,
    },
    events: {
      onReady: () => {
        // Start muted to guarantee autoplay, then restore volume.
        player?.unMute();
        player?.setVolume(Math.round(volume * 100));
      },
      onStateChange: (event: { data: number }) => {
        const state = event.data;
        if (state === 1) {
          player?.unMute();
          startPolling();
          handlers.onState?.(1);
          const d = player?.getDuration() ?? 0;
          if (d > 0) handlers.onDuration?.(d);
        } else if (state === 2) {
          stopPolling();
          handlers.onState?.(2);
        } else if (state === 0) {
          stopPolling();
          handlers.onState?.(0);
        } else if (state === 3 || state === 5 || state === -1) {
          handlers.onState?.(state);
        }
      },
      onError: (event: { data: number }) => {
        handlers.onError?.(event.data);
      },
    },
  });
}

export async function ensureYoutubePlayer() {
  await loadIframeApi();
  if (!player) {
    createPlayer();
  }
  return player;
}

export async function playYoutubeSearch(query: string) {
  await loadIframeApi();
  if (player) {
    try {
      player.destroy();
    } catch {
      // ignore
    }
    player = null;
  }
  createPlayer({ listType: "search", list: query });
}

export function playYoutubeVideo(videoId: string) {
  if (!player) return;
  player.loadVideoById(videoId);
}

export function setYoutubeHandlers(next: YoutubeHandlers) {
  handlers = next;
}

export function controlYoutube(action: "play" | "pause") {
  if (!player) return;
  if (action === "play") player.playVideo();
  else player.pauseVideo();
}

export function seekYoutube(seconds: number) {
  if (!player) return;
  player.seekTo(seconds, true);
}

export function setYoutubeVolume(value: number) {
  volume = value;
  if (player) player.setVolume(Math.round(value * 100));
}

export function stopYoutube() {
  stopPolling();
  if (player) player.pauseVideo();
}

export function getYoutubeCurrentTime(): number {
  return player ? player.getCurrentTime() : 0;
}