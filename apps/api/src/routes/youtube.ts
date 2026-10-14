import type { FastifyInstance } from "fastify";
import { resolveYoutube } from "../modules/youtube/youtube.service.js";

export async function youtubeRoutes(fastify: FastifyInstance) {
  fastify.get("/youtube/resolve", async (request, reply) => {
    const { title, artist } = request.query as {
      title?: string;
      artist?: string;
    };
    if (!title || title.trim().length === 0) {
      return reply.send({ query: "", results: [] });
    }
    const result = await resolveYoutube(title.trim(), artist?.trim() || undefined);
    return reply.send(result);
  });
}