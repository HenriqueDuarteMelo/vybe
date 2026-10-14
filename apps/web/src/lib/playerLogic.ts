export type RepeatMode = "off" | "all" | "one";

export interface NextIndexParams {
  currentIndex: number;
  queueLength: number;
  shuffle: boolean;
  repeat: RepeatMode;
  random?: () => number;
}

export interface NextIndexResult {
  nextIndex: number | null;
  shouldStop: boolean;
}

export function computeNextIndex({
  currentIndex,
  queueLength,
  shuffle,
  repeat,
  random = Math.random,
}: NextIndexParams): NextIndexResult {
  if (queueLength === 0) {
    return { nextIndex: null, shouldStop: true };
  }

  if (repeat === "one") {
    return { nextIndex: currentIndex, shouldStop: false };
  }

  if (shuffle) {
    if (queueLength === 1) {
      return { nextIndex: currentIndex, shouldStop: false };
    }
    let next = Math.floor(random() * queueLength);
    while (next === currentIndex) {
      next = Math.floor(random() * queueLength);
    }
    return { nextIndex: next, shouldStop: false };
  }

  const next = currentIndex + 1;
  if (next >= queueLength) {
    if (repeat === "all") {
      return { nextIndex: 0, shouldStop: false };
    }
    return { nextIndex: null, shouldStop: true };
  }

  return { nextIndex: next, shouldStop: false };
}

export function computePrevIndex(currentIndex: number): number | null {
  if (currentIndex <= 0) return null;
  return currentIndex - 1;
}

export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function removeFromQueueAtIndex(
  queue: unknown[],
  index: number,
  currentIndex: number
): { queue: unknown[]; currentIndex: number } {
  const newQueue = [...queue];
  const [removed] = newQueue.splice(index, 1);
  if (removed === undefined) {
    return { queue, currentIndex };
  }

  let newIndex = currentIndex;
  if (index < currentIndex) {
    newIndex--;
  } else if (index === currentIndex) {
    if (newQueue.length === 0) {
      newIndex = 0;
    } else if (currentIndex >= newQueue.length) {
      newIndex = newQueue.length - 1;
    }
  }

  return { queue: newQueue, currentIndex: newIndex };
}