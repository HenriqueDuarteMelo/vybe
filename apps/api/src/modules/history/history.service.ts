import { prisma } from "../../utils/prisma.js";

const COOLDOWN_SECONDS = 30;

export async function recordListening(userId: string, trackId: string) {
  const cooldownDate = new Date(Date.now() - COOLDOWN_SECONDS * 1000);

  const recent = await prisma.listeningHistory.findFirst({
    where: {
      userId,
      trackId,
      playedAt: { gte: cooldownDate },
    },
  });

  if (recent) {
    return recent;
  }

  return prisma.listeningHistory.create({
    data: { userId, trackId },
  });
}

export async function getHistory(userId: string, page = 1, limit = 50) {
  const skip = (Math.max(1, page) - 1) * limit;

  const [history, total] = await Promise.all([
    prisma.listeningHistory.findMany({
      where: { userId },
      include: {
        track: {
          include: {
            artist: { select: { id: true, name: true, imageUrl: true } },
            album: { select: { id: true, title: true, coverUrl: true } },
          },
        },
      },
      orderBy: { playedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.listeningHistory.count({ where: { userId } }),
  ]);

  return { history, total, page, limit, totalPages: Math.ceil(total / limit) };
}
