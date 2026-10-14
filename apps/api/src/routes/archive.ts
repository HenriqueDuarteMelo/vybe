import type { FastifyInstance } from "fastify";
import { searchArchive, getArchiveItemTracks } from "../modules/archive/archive.service.js";

export async function archiveRoutes(fastify: FastifyInstance) {
  fastify.get("/archive/search", async (request, reply) => {
    const q = (request.query as Record<string, string>).q;
    if (!q?.trim()) {
      return reply.send([]);
    }
    const { tracks, artistMatched } = await searchArchive(q.trim());
    reply.header("x-artist-matched", String(artistMatched));
    return reply.send(tracks);
  });

  fastify.get("/archive/items/:identifier/tracks", async (request, reply) => {
    const { identifier } = request.params as { identifier: string };
    const tracks = await getArchiveItemTracks(identifier);
    return reply.send(tracks);
  });
}
