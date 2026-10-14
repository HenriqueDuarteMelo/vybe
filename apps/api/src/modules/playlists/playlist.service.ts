import { prisma } from "../../utils/prisma.js";
import { NotFoundError, ForbiddenError, ConflictError, BadRequestError } from "../../utils/errors.js";

interface CreatePlaylistInput {
  name: string;
  description?: string;
  isPublic?: boolean;
}

export async function getUserPlaylists(userId: string) {
  return prisma.playlist.findMany({
    where: { userId },
    include: {
      tracks: {
        include: {
          track: {
            include: {
              artist: { select: { id: true, name: true } },
              album: { select: { id: true, title: true, coverUrl: true } },
            },
          },
        },
        orderBy: { position: "asc" },
      },
      _count: { select: { tracks: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function createPlaylist(userId: string, input: CreatePlaylistInput) {
  return prisma.playlist.create({
    data: {
      name: input.name,
      description: input.description,
      isPublic: input.isPublic ?? false,
      userId,
    },
    include: {
      _count: { select: { tracks: true } },
    },
  });
}

export async function getPlaylistById(id: string) {
  const playlist = await prisma.playlist.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, username: true, avatarUrl: true } },
      tracks: {
        include: {
          track: {
            include: {
              artist: { select: { id: true, name: true, imageUrl: true } },
              album: { select: { id: true, title: true, coverUrl: true } },
            },
          },
        },
        orderBy: { position: "asc" },
      },
      _count: { select: { tracks: true } },
    },
  });

  if (!playlist) throw new NotFoundError("Playlist");
  return playlist;
}

export async function updatePlaylist(id: string, userId: string, input: Partial<CreatePlaylistInput>) {
  const playlist = await prisma.playlist.findUnique({ where: { id } });
  if (!playlist) throw new NotFoundError("Playlist");
  if (playlist.userId !== userId) throw new ForbiddenError("Not your playlist");

  return prisma.playlist.update({
    where: { id },
    data: input,
  });
}

export async function deletePlaylist(id: string, userId: string) {
  const playlist = await prisma.playlist.findUnique({ where: { id } });
  if (!playlist) throw new NotFoundError("Playlist");
  if (playlist.userId !== userId) throw new ForbiddenError("Not your playlist");

  await prisma.playlist.delete({ where: { id } });
}

export async function addTrackToPlaylist(playlistId: string, userId: string, trackId: string) {
  const playlist = await prisma.playlist.findUnique({ where: { id: playlistId } });
  if (!playlist) throw new NotFoundError("Playlist");
  if (playlist.userId !== userId) throw new ForbiddenError("Not your playlist");

  const track = await prisma.track.findUnique({ where: { id: trackId } });
  if (!track) throw new NotFoundError("Track");

  const existing = await prisma.playlistTrack.findUnique({
    where: { playlistId_trackId: { playlistId, trackId } },
  });
  if (existing) throw new ConflictError("Track already in playlist");

  const maxPosition = await prisma.playlistTrack.aggregate({
    where: { playlistId },
    _max: { position: true },
  });

  const nextPosition = (maxPosition._max.position ?? -1) + 1;

  return prisma.playlistTrack.create({
    data: { playlistId, trackId, position: nextPosition },
    include: {
      track: {
        include: {
          artist: { select: { id: true, name: true } },
          album: { select: { id: true, title: true, coverUrl: true } },
        },
      },
    },
  });
}

export async function removeTrackFromPlaylist(playlistId: string, userId: string, trackId: string) {
  const playlist = await prisma.playlist.findUnique({ where: { id: playlistId } });
  if (!playlist) throw new NotFoundError("Playlist");
  if (playlist.userId !== userId) throw new ForbiddenError("Not your playlist");

  const playlistTrack = await prisma.playlistTrack.findUnique({
    where: { playlistId_trackId: { playlistId, trackId } },
  });
  if (!playlistTrack) throw new NotFoundError("Track in playlist");

  await prisma.playlistTrack.delete({ where: { id: playlistTrack.id } });

  const remaining = await prisma.playlistTrack.findMany({
    where: { playlistId },
    orderBy: { position: "asc" },
  });

  await prisma.$transaction(
    remaining.map((pt, index) =>
      prisma.playlistTrack.update({
        where: { id: pt.id },
        data: { position: index },
      })
    )
  );
}

export async function reorderPlaylist(playlistId: string, userId: string, trackIds: string[]) {
  const playlist = await prisma.playlist.findUnique({ where: { id: playlistId } });
  if (!playlist) throw new NotFoundError("Playlist");
  if (playlist.userId !== userId) throw new ForbiddenError("Not your playlist");

  await prisma.$transaction(
    trackIds.map((trackId, index) =>
      prisma.playlistTrack.updateMany({
        where: { playlistId, trackId },
        data: { position: index },
      })
    )
  );
}
