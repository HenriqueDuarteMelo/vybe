import { prisma } from "../../utils/prisma.js";
import { NotFoundError } from "../../utils/errors.js";

interface AlbumQuery {
  page?: number;
  limit?: number;
  artistId?: string;
}

export async function getAlbums(query: AlbumQuery) {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 20));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (query.artistId) {
    where.artistId = query.artistId;
  }

  const [albums, total] = await Promise.all([
    prisma.album.findMany({
      where,
      include: {
        artist: { select: { id: true, name: true, imageUrl: true } },
        _count: { select: { tracks: true } },
      },
      orderBy: { releaseYear: "desc" },
      skip,
      take: limit,
    }),
    prisma.album.count({ where }),
  ]);

  return { albums, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getAlbumById(id: string) {
  const album = await prisma.album.findUnique({
    where: { id },
    include: {
      artist: { select: { id: true, name: true, imageUrl: true } },
      tracks: {
        include: {
          artist: { select: { id: true, name: true } },
          genres: { select: { id: true, name: true } },
        },
        orderBy: { trackNumber: "asc" },
      },
    },
  });

  if (!album) throw new NotFoundError("Album");
  return album;
}
