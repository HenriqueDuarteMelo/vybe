import { prisma } from "../../utils/prisma.js";
import { NotFoundError } from "../../utils/errors.js";

interface TrackQuery {
  page?: number;
  limit?: number;
  genreId?: string;
  artistId?: string;
  albumId?: string;
}

export async function getTracks(query: TrackQuery) {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 20));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (query.genreId) {
    where.genres = { some: { id: query.genreId } };
  }
  if (query.artistId) {
    where.artistId = query.artistId;
  }
  if (query.albumId) {
    where.albumId = query.albumId;
  }

  const [tracks, total] = await Promise.all([
    prisma.track.findMany({
      where,
      include: {
        artist: { select: { id: true, name: true, imageUrl: true } },
        album: { select: { id: true, title: true, coverUrl: true } },
        genres: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.track.count({ where }),
  ]);

  return { tracks, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getTrackById(id: string) {
  const track = await prisma.track.findUnique({
    where: { id },
    include: {
      artist: { select: { id: true, name: true, imageUrl: true, bio: true } },
      album: {
        select: {
          id: true,
          title: true,
          coverUrl: true,
          releaseYear: true,
          tracks: { select: { id: true, title: true, duration: true, trackNumber: true }, orderBy: { trackNumber: "asc" } },
        },
      },
      genres: { select: { id: true, name: true } },
      _count: { select: { favorites: true } },
    },
  });

  if (!track) throw new NotFoundError("Track");
  return track;
}

export async function getTracksByIds(ids: string[]) {
  return prisma.track.findMany({
    where: { id: { in: ids } },
    include: {
      artist: { select: { id: true, name: true, imageUrl: true } },
      album: { select: { id: true, title: true, coverUrl: true } },
    },
  });
}
