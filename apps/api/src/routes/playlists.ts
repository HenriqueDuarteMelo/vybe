import type { FastifyInstance } from "fastify";
import { z } from "zod";
import * as playlistService from "../modules/playlists/playlist.service.js";
import { importTrackSchema, resolveTrackId } from "../modules/imports/import.service.js";
import { sendError, BadRequestError } from "../utils/errors.js";

const createPlaylistSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  isPublic: z.boolean().optional(),
});

const updatePlaylistSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  isPublic: z.boolean().optional(),
});

const addTrackSchema = z.object({
  trackId: z.string().min(1),
  track: importTrackSchema.optional(),
});

const reorderSchema = z.object({
  trackIds: z.array(z.string().uuid()),
});

export async function playlistRoutes(fastify: FastifyInstance) {
  fastify.get("/playlists", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const playlists = await playlistService.getUserPlaylists(request.user.userId);
      return reply.send(playlists);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  fastify.post("/playlists", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const input = createPlaylistSchema.parse(request.body);
      const playlist = await playlistService.createPlaylist(request.user.userId, input);
      return reply.status(201).send(playlist);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return sendError(reply, new BadRequestError(error.errors[0].message));
      }
      return sendError(reply, error);
    }
  });

  fastify.get("/playlists/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const playlist = await playlistService.getPlaylistById(id);
      return reply.send(playlist);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  fastify.put("/playlists/:id", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const input = updatePlaylistSchema.parse(request.body);
      const playlist = await playlistService.updatePlaylist(id, request.user.userId, input);
      return reply.send(playlist);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return sendError(reply, new BadRequestError(error.errors[0].message));
      }
      return sendError(reply, error);
    }
  });

  fastify.delete("/playlists/:id", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      await playlistService.deletePlaylist(id, request.user.userId);
      return reply.status(204).send();
    } catch (error) {
      return sendError(reply, error);
    }
  });

  fastify.post("/playlists/:id/tracks", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { trackId, track } = addTrackSchema.parse(request.body);
      const localTrackId = await resolveTrackId(request.user.userId, trackId, track);
      const result = await playlistService.addTrackToPlaylist(id, request.user.userId, localTrackId);
      return reply.status(201).send(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return sendError(reply, new BadRequestError(error.errors[0].message));
      }
      return sendError(reply, error);
    }
  });

  fastify.delete("/playlists/:id/tracks/:trackId", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id, trackId } = request.params as { id: string; trackId: string };
      await playlistService.removeTrackFromPlaylist(id, request.user.userId, trackId);
      return reply.status(204).send();
    } catch (error) {
      return sendError(reply, error);
    }
  });

  fastify.put("/playlists/:id/reorder", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { trackIds } = reorderSchema.parse(request.body);
      await playlistService.reorderPlaylist(id, request.user.userId, trackIds);
      return reply.send({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return sendError(reply, new BadRequestError(error.errors[0].message));
      }
      return sendError(reply, error);
    }
  });
}
