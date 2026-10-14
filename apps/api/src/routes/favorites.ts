import type { FastifyInstance } from "fastify";
import { z } from "zod";
import * as favoriteService from "../modules/favorites/favorite.service.js";
import { importTrackSchema, resolveTrackId } from "../modules/imports/import.service.js";
import { sendError, BadRequestError } from "../utils/errors.js";

const favoriteBodySchema = z
  .object({ track: importTrackSchema.optional() })
  .optional();

export async function favoriteRoutes(fastify: FastifyInstance) {
  fastify.get("/favorites", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const favorites = await favoriteService.getFavorites(request.user.userId);
      return reply.send(favorites);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  fastify.post("/tracks/:id/favorite", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = favoriteBodySchema.parse(request.body);
      const trackId = await resolveTrackId(request.user.userId, id, body?.track);
      await favoriteService.addFavorite(request.user.userId, trackId);
      return reply.status(201).send({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return sendError(reply, new BadRequestError(error.errors[0].message));
      }
      return sendError(reply, error);
    }
  });

  fastify.delete("/tracks/:id/favorite", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      await favoriteService.removeFavorite(request.user.userId, id);
      return reply.status(204).send();
    } catch (error) {
      return sendError(reply, error);
    }
  });

  fastify.get("/tracks/:id/favorite/status", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const isFavorited = await favoriteService.isFavorited(request.user.userId, id);
      return reply.send({ isFavorited });
    } catch (error) {
      return sendError(reply, error);
    }
  });
}
