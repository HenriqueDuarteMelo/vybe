import type { FastifyInstance } from "fastify";
import * as albumService from "../modules/albums/album.service.js";
import { sendError } from "../utils/errors.js";

export async function albumRoutes(fastify: FastifyInstance) {
  fastify.get("/albums", async (request, reply) => {
    try {
      const { page, limit, artistId } = request.query as Record<string, string>;
      const result = await albumService.getAlbums({
        page: page ? parseInt(page) : undefined,
        limit: limit ? parseInt(limit) : undefined,
        artistId,
      });
      return reply.send(result);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  fastify.get("/albums/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const album = await albumService.getAlbumById(id);
      return reply.send(album);
    } catch (error) {
      return sendError(reply, error);
    }
  });
}
