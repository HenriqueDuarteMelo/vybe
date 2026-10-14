import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "../../utils/prisma.js";

export const importTrackSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(300),
  duration: z.number().int().min(0).optional().default(0),
  audioUrl: z.string().nullable().optional(),
  trackNumber: z.number().int().nullable().optional(),
  artistId: z.string().nullable().optional(),
  artistName: z.string().min(1).max(300),
  artistImageUrl: z.string().nullable().optional(),
  albumId: z.string().nullable().optional(),
  albumTitle: z.string().min(1).max(300),
  albumCoverUrl: z.string().nullable().optional(),
});

export type ImportTrackInput = z.infer<typeof importTrackSchema>;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isLocalTrackId(id: string): boolean {
  return UUID_RE.test(id);
}

function toUuid(seed: string): string {
  const hash = createHash("md5").update(seed).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

export async function importTrack(userId: string, input: ImportTrackInput) {
  const trackId = toUuid(`track:${input.id}`);
  const existing = await prisma.track.findUnique({
    where: { id: trackId },
    include: {
      artist: { select: { id: true, name: true, imageUrl: true } },
      album: { select: { id: true, title: true, coverUrl: true } },
    },
  });
  if (existing) return existing;

  const artistSeed = input.artistId ?? input.artistName;
  const artistId = toUuid(`artist:${artistSeed}`);
  const albumSeed = input.albumId ?? `${input.albumTitle}::${input.artistName}`;
  const albumId = toUuid(`album:${albumSeed}`);

  return prisma.$transaction(async (tx) => {
    await tx.artist.upsert({
      where: { id: artistId },
      create: {
        id: artistId,
        name: input.artistName,
        imageUrl: input.artistImageUrl ?? null,
      },
      update: {},
    });

    await tx.album.upsert({
      where: { id: albumId },
      create: {
        id: albumId,
        title: input.albumTitle,
        coverUrl: input.albumCoverUrl ?? null,
        artistId,
      },
      update: {},
    });

    return tx.track.create({
      data: {
        id: trackId,
        title: input.title,
        duration: input.duration ?? 0,
        audioUrl: input.audioUrl ?? null,
        trackNumber: input.trackNumber ?? null,
        artistId,
        albumId,
      },
      include: {
        artist: { select: { id: true, name: true, imageUrl: true } },
        album: { select: { id: true, title: true, coverUrl: true } },
      },
    });
  });
}

export async function resolveTrackId(
  userId: string,
  trackId: string,
  remoteTrack?: ImportTrackInput
): Promise<string> {
  const local = await prisma.track.findUnique({ where: { id: trackId } });
  if (local) return local.id;

  if (!remoteTrack) return trackId;

  const imported = await importTrack(userId, remoteTrack);
  return imported.id;
}
