import type { FastifyInstance } from "fastify";
import { z } from "zod";
import * as authService from "../modules/auth/auth.service.js";
import { sendError, BadRequestError } from "../utils/errors.js";

const registerSchema = z.object({
  email: z.string().email("Invalid email format"),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, "Username must be alphanumeric with underscores"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const loginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post("/auth/register", async (request, reply) => {
    try {
      const input = registerSchema.parse(request.body);
      const result = await authService.register(input);
      return reply.status(201).send(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return sendError(reply, new BadRequestError(error.errors[0].message));
      }
      return sendError(reply, error);
    }
  });

  fastify.post("/auth/login", async (request, reply) => {
    try {
      const input = loginSchema.parse(request.body);
      const result = await authService.login(input);
      return reply.send(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return sendError(reply, new BadRequestError(error.errors[0].message));
      }
      return sendError(reply, error);
    }
  });

  fastify.get("/auth/me", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const profile = await authService.getProfile(request.user.userId);
      return reply.send(profile);
    } catch (error) {
      return sendError(reply, error);
    }
  });
}
