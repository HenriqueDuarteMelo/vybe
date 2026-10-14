import { prisma } from "../../utils/prisma.js";
import { NotFoundError, ConflictError } from "../../utils/errors.js";

export async function getFavorites(userId: string) {
  return prisma.favorite.findMany({
    where: { userId },
    include: {
      track: {
        include: {
          artist: { select: { id: true, name: true, imageUrl: true } },
          album: { select: { id: true, title: true, coverUrl: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function addFavorite(userId: string, trackId: string) {
  const track = await prisma.track.findUnique({ where: { id: trackId } });
  if (!track) throw new NotFoundError("Track");

  const existing = await prisma.favorite.findUnique({
    where: { userId_trackId: { userId, trackId } },
  });
  if (existing) throw new ConflictError("Track already favorited");

  return prisma.favorite.create({
    data: { userId, trackId },
  });
}

export async function removeFavorite(userId: string, trackId: string) {
  const favorite = await prisma.favorite.findUnique({
    where: { userId_trackId: { userId, trackId } },
  });
  if (!favorite) throw new NotFoundError("Favorite");

  await prisma.favorite.delete({ where: { id: favorite.id } });
}

export async function isFavorited(userId: string, trackId: string): Promise<boolean> {
  const favorite = await prisma.favorite.findUnique({
    where: { userId_trackId: { userId, trackId } },
  });
  return !!favorite;
}
