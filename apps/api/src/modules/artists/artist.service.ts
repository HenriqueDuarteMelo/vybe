import { prisma } from "../../utils/prisma.js";
import { NotFoundError } from "../../utils/errors.js";

interface ArtistQuery {
  page?: number;
  limit?: number;
}

export async function getArtists(query: ArtistQuery) {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 20));
  const skip = (page - 1) * limit;

  const [artists, total] = await Promise.all([
    prisma.artist.findMany({
      include: {
        _count: { select: { albums: true, tracks: true } },
      },
      orderBy: { name: "asc" },
      skip,
      take: limit,
    }),
    prisma.artist.count(),
  ]);

  return { artists, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getArtistById(id: string) {
  const artist = await prisma.artist.findUnique({
    where: { id },
    include: {
      albums: {
        include: {
          tracks: { select: { id: true, title: true, duration: true, trackNumber: true } },
        },
        orderBy: { releaseYear: "desc" },
      },
      _count: { select: { tracks: true, albums: true } },
    },
  });

  if (!artist) throw new NotFoundError("Artist");
  return artist;
}

export async function getArtistTopTracks(artistId: string, limit = 10) {
  return prisma.track.findMany({
    where: { artistId },
    include: {
      album: { select: { id: true, title: true, coverUrl: true } },
    },
    orderBy: { favorites: { _count: "desc" } },
    take: limit,
  });
}
