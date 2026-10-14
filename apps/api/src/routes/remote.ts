import type { FastifyInstance } from "fastify";
import { getRemoteCatalog } from "../modules/remote/remote.service.js";

export async function remoteRoutes(fastify: FastifyInstance) {
  fastify.get("/remote/catalog", async (_request, reply) => {
    return reply.send(getRemoteCatalog());
  });
}
