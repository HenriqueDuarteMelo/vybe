import type { FastifyInstance } from "fastify";
import * as discoverService from "../modules/discover/discover.service.js";
import { enrichFullOnly } from "../modules/enrichment/enrichment.service.js";
import { sendError, BadRequestError } from "../utils/errors.js";

export async function discoverRoutes(fastify: FastifyInstance) {
  fastify.get("/discover/search", async (request, reply) => {
    try {
      const { q } = request.query as { q?: string };
      if (!q || q.trim().length === 0) {
        return reply.send({ tracks: [], artists: [], albums: [] });
      }
      const results = await discoverService.searchDeezer(q.trim());
      results.tracks = await enrichFullOnly(results.tracks);
      return reply.send(results);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  fastify.get("/discover/artist/:deezerId", async (request, reply) => {
    try {
      const { deezerId } = request.params as { deezerId: string };
      const id = deezerId.replace("deezer:", "");
      const [artist, topTracks, albums] = await Promise.all([
        discoverService.getDeezerArtist(id),
        enrichFullOnly(await discoverService.getDeezerArtistTopTracks(id)),
        discoverService.getDeezerArtistAlbums(id),
      ]);
      return reply.send({ artist, topTracks, albums });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  fastify.get("/discover/album/:deezerId", async (request, reply) => {
    try {
      const { deezerId } = request.params as { deezerId: string };
      const id = deezerId.replace("deezer:", "");
      const album = await discoverService.getDeezerAlbum(id);
      album.tracks = await enrichFullOnly(album.tracks);
      return reply.send(album);
    } catch (error) {
      return sendError(reply, error);
    }
  });
}