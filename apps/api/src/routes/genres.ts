import type { FastifyInstance } from "fastify";
import { prisma } from "../utils/prisma.js";
import { sendError } from "../utils/errors.js";

export async function genreRoutes(fastify: FastifyInstance) {
  fastify.get("/genres", async (_request, reply) => {
    try {
      const genres = await prisma.genre.findMany({
        include: { _count: { select: { tracks: true } } },
        orderBy: { name: "asc" },
      });
      return reply.send(genres);
    } catch (error) {
      return sendError(reply, error);
    }
  });
}
