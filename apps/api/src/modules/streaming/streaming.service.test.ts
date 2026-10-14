import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  parseRange,
  getContentType,
  createFileStream,
} from "./streaming.service.js";
import { writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const fixturePath = join(tmpdir(), "vybe-stream-fixture.bin");

beforeEach(() => {
  writeFileSync(fixturePath, Buffer.alloc(1000, 42));
});

afterEach(() => {
  rmSync(fixturePath, { force: true });
});

describe("parseRange", () => {
  const fileSize = 1000;

  it("returns null when no range header is provided", () => {
    expect(parseRange(undefined, fileSize)).toBeNull();
  });

  it("parses a simple range request", () => {
    const range = parseRange("bytes=0-499", fileSize);
    expect(range).toEqual({ start: 0, end: 499, total: 1000 });
  });

  it("parses suffix range (open-ended)", () => {
    const range = parseRange("bytes=500-", fileSize);
    expect(range).toEqual({ start: 500, end: 999, total: 1000 });
  });

  it("returns null for invalid start greater than end", () => {
    expect(parseRange("bytes=500-100", fileSize)).toBeNull();
  });

  it("returns null for start beyond file size", () => {
    expect(parseRange("bytes=1000-2000", fileSize)).toBeNull();
  });

  it("returns null for negative start", () => {
    expect(parseRange("bytes=-5-10", fileSize)).toBeNull();
  });

  it("returns null for non-bytes unit", () => {
    expect(parseRange("items=0-10", fileSize)).toBeNull();
  });
});

describe("getContentType", () => {
  it("returns audio/mpeg for mp3", () => {
    expect(getContentType("track.mp3")).toBe("audio/mpeg");
  });

  it("returns audio/wav for wav", () => {
    expect(getContentType("track.wav")).toBe("audio/wav");
  });

  it("returns audio/webm for webm", () => {
    expect(getContentType("track.webm")).toBe("audio/webm");
  });

  it("falls back to octet-stream for unknown extensions", () => {
    expect(getContentType("track.xyz")).toBe("application/octet-stream");
  });
});

describe("createFileStream", () => {
  it("streams only the requested byte range", async () => {
    const stream = createFileStream(fixturePath, { start: 100, end: 199, total: 1000 });
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const data = Buffer.concat(chunks);
    expect(data).toHaveLength(100);
    expect(data.every((byte) => byte === 42)).toBe(true);
  });

  it("streams the whole file without a range", async () => {
    const stream = createFileStream(fixturePath, null);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const data = Buffer.concat(chunks);
    expect(data).toHaveLength(1000);
  });
});