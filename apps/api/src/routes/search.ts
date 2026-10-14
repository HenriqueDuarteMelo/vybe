import type { FastifyInstance } from "fastify";
import * as searchService from "../modules/search/search.service.js";
import { sendError } from "../utils/errors.js";

export async function searchRoutes(fastify: FastifyInstance) {
  fastify.get("/search", async (request, reply) => {
    try {
      const { q, page, limit, type } = request.query as Record<string, string>;
      if (!q || q.trim().length === 0) {
        return reply.send({ top: null, tracks: [], artists: [], albums: [], genres: [] });
      }
      const results = await searchService.search({
        q,
        page: page ? parseInt(page) : undefined,
        limit: limit ? parseInt(limit) : undefined,
        type: type as "track" | "artist" | "album" | "genre" | "all" | undefined,
      });
      return reply.send(results);
    } catch (error) {
      return sendError(reply, error);
    }
  });
}
