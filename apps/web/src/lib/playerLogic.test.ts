import { describe, it, expect, vi } from "vitest";
import {
  computeNextIndex,
  computePrevIndex,
  formatDuration,
  removeFromQueueAtIndex,
} from "./playerLogic";

describe("computeNextIndex", () => {
  it("returns shouldStop when queue is empty", () => {
    expect(computeNextIndex({ currentIndex: 0, queueLength: 0, shuffle: false, repeat: "off" })).toEqual({
      nextIndex: null,
      shouldStop: true,
    });
  });

  it("advances sequentially when shuffle is off", () => {
    expect(computeNextIndex({ currentIndex: 0, queueLength: 5, shuffle: false, repeat: "off" })).toEqual({
      nextIndex: 1,
      shouldStop: false,
    });
  });

  it("stops at the end when repeat is off", () => {
    expect(computeNextIndex({ currentIndex: 4, queueLength: 5, shuffle: false, repeat: "off" })).toEqual({
      nextIndex: null,
      shouldStop: true,
    });
  });

  it("loops to 0 when repeat is all", () => {
    expect(computeNextIndex({ currentIndex: 4, queueLength: 5, shuffle: false, repeat: "all" })).toEqual({
      nextIndex: 0,
      shouldStop: false,
    });
  });

  it("stays on the same track when repeat is one", () => {
    expect(computeNextIndex({ currentIndex: 2, queueLength: 5, shuffle: false, repeat: "one" })).toEqual({
      nextIndex: 2,
      shouldStop: false,
    });
  });

  it("picks a different index when shuffle is on", () => {
    const random = vi.fn().mockReturnValueOnce(0.2).mockReturnValueOnce(0.6);
    const result = computeNextIndex({
      currentIndex: 1,
      queueLength: 5,
      shuffle: true,
      repeat: "off",
      random,
    });
    expect(result.nextIndex).not.toBe(1);
    expect(result.shouldStop).toBe(false);
  });

  it("keeps same index with shuffle on a single-track queue", () => {
    expect(computeNextIndex({ currentIndex: 0, queueLength: 1, shuffle: true, repeat: "off" })).toEqual({
      nextIndex: 0,
      shouldStop: false,
    });
  });
});

describe("computePrevIndex", () => {
  it("returns previous index", () => {
    expect(computePrevIndex(3)).toBe(2);
  });

  it("returns null at the start of the queue", () => {
    expect(computePrevIndex(0)).toBeNull();
  });
});

describe("formatDuration", () => {
  it("formats minutes and seconds", () => {
    expect(formatDuration(125)).toBe("2:05");
  });

  it("pads seconds", () => {
    expect(formatDuration(61)).toBe("1:01");
  });

  it("handles zero", () => {
    expect(formatDuration(0)).toBe("0:00");
  });
});

describe("removeFromQueueAtIndex", () => {
  const queue = ["a", "b", "c", "d"];

  it("removes a track before the current one and shifts the index", () => {
    const { queue: q, currentIndex } = removeFromQueueAtIndex(queue, 1, 3);
    expect(q).toEqual(["a", "c", "d"]);
    expect(currentIndex).toBe(2);
  });

  it("removes the current track", () => {
    const { queue: q, currentIndex } = removeFromQueueAtIndex(queue, 2, 2);
    expect(q).toEqual(["a", "b", "d"]);
    expect(currentIndex).toBe(2);
  });

  it("clamps index when the last track is removed", () => {
    const { queue: q, currentIndex } = removeFromQueueAtIndex(queue, 3, 3);
    expect(q).toEqual(["a", "b", "c"]);
    expect(currentIndex).toBe(2);
  });

  it("resets index when queue becomes empty", () => {
    const { queue: q, currentIndex } = removeFromQueueAtIndex(["a"], 0, 0);
    expect(q).toEqual([]);
    expect(currentIndex).toBe(0);
  });
});