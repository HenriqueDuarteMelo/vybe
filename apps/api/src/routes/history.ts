import type { FastifyInstance } from "fastify";
import * as historyService from "../modules/history/history.service.js";
import { sendError, BadRequestError } from "../utils/errors.js";
import { z } from "zod";

const recordSchema = z.object({
  trackId: z.string().uuid(),
});

export async function historyRoutes(fastify: FastifyInstance) {
  fastify.get("/history", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { page, limit } = request.query as Record<string, string>;
      const result = await historyService.getHistory(
        request.user.userId,
        page ? parseInt(page) : undefined,
        limit ? parseInt(limit) : undefined
      );
      return reply.send(result);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  fastify.post("/history", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { trackId } = recordSchema.parse(request.body);
      const record = await historyService.recordListening(request.user.userId, trackId);
      return reply.status(201).send(record);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return sendError(reply, new BadRequestError(error.errors[0].message));
      }
      return sendError(reply, error);
    }
  });
}
