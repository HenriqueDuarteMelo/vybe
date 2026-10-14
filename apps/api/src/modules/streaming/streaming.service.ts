import { createReadStream, statSync, existsSync } from "fs";
import { join, resolve } from "path";
import { prisma } from "../../utils/prisma.js";
import { NotFoundError, BadRequestError } from "../../utils/errors.js";

const UPLOAD_DIR = resolve(process.env.UPLOAD_DIR || "./uploads");

interface StreamRange {
  start: number;
  end: number;
  total: number;
}

export async function getTrackFilePath(trackId: string): Promise<string> {
  const track = await prisma.track.findUnique({ where: { id: trackId } });
  if (!track) throw new NotFoundError("Track");
  if (!track.audioUrl) throw new BadRequestError("Track has no audio file");

  const filePath = join(UPLOAD_DIR, track.audioUrl);
  if (!existsSync(filePath)) throw new NotFoundError("Audio file");

  return filePath;
}

export function getFileStats(filePath: string) {
  return statSync(filePath);
}

export function parseRange(
  rangeHeader: string | undefined,
  fileSize: number
): StreamRange | null {
  if (!rangeHeader || !rangeHeader.startsWith("bytes=")) {
    return null;
  }

  const parts = rangeHeader.replace(/bytes=/, "").split("-");
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

  if (isNaN(start) || isNaN(end) || start > end || start < 0 || end >= fileSize) {
    return null;
  }

  return { start, end, total: fileSize };
}

export function createFileStream(filePath: string, range: StreamRange | null) {
  if (!range) {
    return createReadStream(filePath);
  }

  return createReadStream(filePath, { start: range.start, end: range.end });
}

export function getContentType(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();
  const types: Record<string, string> = {
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    flac: "audio/flac",
    aac: "audio/aac",
    m4a: "audio/mp4",
    webm: "audio/webm",
  };
  return types[ext || ""] || "application/octet-stream";
}
