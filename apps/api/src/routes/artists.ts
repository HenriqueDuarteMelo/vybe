import type { FastifyInstance } from "fastify";
import * as artistService from "../modules/artists/artist.service.js";
import { sendError } from "../utils/errors.js";

export async function artistRoutes(fastify: FastifyInstance) {
  fastify.get("/artists", async (request, reply) => {
    try {
      const { page, limit } = request.query as Record<string, string>;
      const result = await artistService.getArtists({
        page: page ? parseInt(page) : undefined,
        limit: limit ? parseInt(limit) : undefined,
      });
      return reply.send(result);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  fastify.get("/artists/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const artist = await artistService.getArtistById(id);
      return reply.send(artist);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  fastify.get("/artists/:id/top-tracks", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { limit } = request.query as Record<string, string>;
      const tracks = await artistService.getArtistTopTracks(
        id,
        limit ? parseInt(limit) : 10
      );
      return reply.send(tracks);
    } catch (error) {
      return sendError(reply, error);
    }
  });
}
