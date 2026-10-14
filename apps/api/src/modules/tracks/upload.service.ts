import { createWriteStream, openSync, readSync, closeSync, unlinkSync, existsSync, mkdirSync } from "fs";
import { pipeline } from "stream/promises";
import { join, resolve } from "path";
import { randomUUID } from "crypto";
import type { Readable } from "stream";
import { prisma } from "../../utils/prisma.js";
import { NotFoundError, BadRequestError } from "../../utils/errors.js";

const UPLOAD_DIR = resolve(process.env.UPLOAD_DIR || "./uploads");

const ALLOWED_MIMES: Record<string, string> = {
  "audio/mpeg": ".mp3",
  "audio/wav": ".wav",
  "audio/ogg": ".ogg",
  "audio/flac": ".flac",
  "audio/aac": ".aac",
  "audio/mp4": ".m4a",
  "audio/webm": ".webm",
};

export function resolveUploadDir(): string {
  if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });
  return UPLOAD_DIR;
}

export function isSupportedMime(mime: string | undefined): string | null {
  if (!mime) return null;
  return ALLOWED_MIMES[mime] ?? null;
}

export async function saveUploadedAudio(
  stream: Readable,
  mime: string | undefined
): Promise<{ fileName: string; filePath: string }> {
  const ext = isSupportedMime(mime);
  if (!ext) {
    throw new BadRequestError(`Unsupported audio type: ${mime || "unknown"}`);
  }

  const fileName = `${randomUUID()}${ext}`;
  const filePath = join(resolveUploadDir(), fileName);

  try {
    await pipeline(stream, createWriteStream(filePath));
  } catch {
    if (existsSync(filePath)) unlinkSync(filePath);
    throw new BadRequestError("Failed to save audio file");
  }

  return { fileName, filePath };
}

export function removeUploadedAudio(fileName: string) {
  const filePath = join(UPLOAD_DIR, fileName);
  if (existsSync(filePath)) unlinkSync(filePath);
}

function detectWavDuration(filePath: string): number | undefined {
  try {
    const fd = openSync(filePath, "r");
    const header = Buffer.alloc(256);
    const read = readSync(fd, header, 0, header.length, 0);
    closeSync(fd);
    if (read < 12) return undefined;
    if (header.toString("ascii", 0, 4) !== "RIFF" || header.toString("ascii", 8, 12) !== "WAVE") {
      return undefined;
    }
    const byteRate = header.readUInt32LE(28);
    if (!byteRate) return undefined;

    let dataSize = 0;
    let offset = 12;
    while (offset + 8 <= read) {
      const id = header.toString("ascii", offset, offset + 4);
      const size = header.readUInt32LE(offset + 4);
      if (id === "data") {
        dataSize = size;
        break;
      }
      offset += 8 + size + (size % 2);
      if (offset + 8 > read && read < 4096) return undefined;
    }
    if (!dataSize) return undefined;
    return Math.round(dataSize / byteRate);
  } catch {
    return undefined;
  }
}

interface CreateTrackInput {
  title: string;
  artistId: string;
  albumId: string;
  genreIds?: string[];
  trackNumber?: number;
  duration?: number;
}

export async function createTrackWithAudio(
  input: CreateTrackInput,
  fileName: string,
  filePath: string
) {
  const album = await prisma.album.findUnique({ where: { id: input.albumId } });
  if (!album) throw new NotFoundError("Album");
  if (album.artistId !== input.artistId) {
    throw new BadRequestError("Album does not belong to the given artist");
  }

  if (input.genreIds && input.genreIds.length > 0) {
    const genres = await prisma.genre.findMany({ where: { id: { in: input.genreIds } } });
    if (genres.length !== input.genreIds.length) {
      throw new BadRequestError("One or more genres not found");
    }
  }

  let duration = input.duration;
  if (!duration || duration <= 0) {
    if (fileName.endsWith(".wav")) {
      duration = detectWavDuration(filePath);
    }
  }
  if (!duration || duration <= 0) {
    throw new BadRequestError("duration is required (seconds)");
  }

  const track = await prisma.track.create({
    data: {
      title: input.title,
      duration,
      trackNumber: input.trackNumber,
      audioUrl: fileName,
      artistId: input.artistId,
      albumId: input.albumId,
      genres: input.genreIds?.length
        ? { connect: input.genreIds.map((id) => ({ id })) }
        : undefined,
    },
    include: {
      artist: { select: { id: true, name: true, imageUrl: true } },
      album: { select: { id: true, title: true, coverUrl: true } },
      genres: { select: { id: true, name: true } },
    },
  });

  return track;
}