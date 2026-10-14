import type { FastifyInstance } from "fastify";
import { z } from "zod";
import * as trackService from "../modules/tracks/track.service.js";
import { saveUploadedAudio, removeUploadedAudio, createTrackWithAudio } from "../modules/tracks/upload.service.js";
import { sendError, BadRequestError } from "../utils/errors.js";

const createTrackSchema = z.object({
  title: z.string().min(1).max(200),
  artistId: z.string().uuid(),
  albumId: z.string().uuid(),
  genreIds: z.string().optional(),
  trackNumber: z.string().optional(),
  duration: z.string().optional(),
});

export async function trackRoutes(fastify: FastifyInstance) {
  fastify.get("/tracks", async (request, reply) => {
    try {
      const { page, limit, genreId, artistId, albumId } = request.query as Record<string, string>;
      const result = await trackService.getTracks({
        page: page ? parseInt(page) : undefined,
        limit: limit ? parseInt(limit) : undefined,
        genreId,
        artistId,
        albumId,
      });
      return reply.send(result);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  fastify.get("/tracks/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const track = await trackService.getTrackById(id);
      return reply.send(track);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  fastify.post("/tracks", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const fields: Record<string, string> = {};
    let saved: { fileName: string; filePath: string } | null = null;

    try {
      if (!request.isMultipart()) throw new BadRequestError("Multipart form required");

      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === "file") {
          if (saved) throw new BadRequestError("Only one audio file allowed");
          saved = await saveUploadedAudio(part.file, part.mimetype);
        } else if (part.value !== undefined) {
          fields[part.fieldname] = String(part.value);
        }
      }

      if (!saved) throw new BadRequestError("Audio file is required");

      const parsed = createTrackSchema.parse(fields);
      const genreIds = parsed.genreIds ? JSON.parse(parsed.genreIds) : undefined;
      let trackNumber: number | undefined;
      let duration: number | undefined;
      if (parsed.trackNumber !== undefined) trackNumber = parseInt(parsed.trackNumber, 10);
      if (parsed.duration !== undefined) duration = parseInt(parsed.duration, 10);

      const track = await createTrackWithAudio(
        {
          title: parsed.title,
          artistId: parsed.artistId,
          albumId: parsed.albumId,
          genreIds,
          trackNumber,
          duration,
        },
        saved.fileName,
        saved.filePath
      );

      return reply.status(201).send(track);
    } catch (error) {
      if (saved) removeUploadedAudio(saved.fileName);
      if (error instanceof z.ZodError) {
        return sendError(reply, new BadRequestError(error.errors[0].message));
      }
      if (error instanceof SyntaxError) {
        return sendError(reply, new BadRequestError("genreIds must be a JSON array"));
      }
      return sendError(reply, error);
    }
  });
}