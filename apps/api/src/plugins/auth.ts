import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { verifyToken, type TokenPayload } from "../utils/auth.js";
import { resolveUserId } from "../modules/auth/auth.service.js";
import { UnauthorizedError, sendError } from "../utils/errors.js";

declare module "fastify" {
  interface FastifyRequest {
    user: TokenPayload;
  }

  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export async function authPlugin(fastify: FastifyInstance) {
  fastify.decorateRequest("user", null as unknown as TokenPayload);

  fastify.decorate(
    "authenticate",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const authHeader = request.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
          throw new UnauthorizedError("Missing or invalid authorization header");
        }

        const token = authHeader.slice(7);
        const payload = verifyToken(token);
        payload.userId = await resolveUserId(payload.userId);
        request.user = payload;
      } catch {
        sendError(reply, new UnauthorizedError());
      }
    }
  );
}