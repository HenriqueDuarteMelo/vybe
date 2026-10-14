import type { FastifyInstance } from "fastify";
import { resolveAudioUrl, proxyAudioStream } from "../modules/youtubeProxy/youtubeProxy.service.js";
import { sendError, BadRequestError } from "../utils/errors.js";

export async function audioProxyRoutes(fastify: FastifyInstance) {
  fastify.get("/stream/youtube", async (request, reply) => {
    try {
      const { videoId } = request.query as { videoId?: string };
      if (!videoId || videoId.trim().length === 0) {
        throw new BadRequestError("videoId is required");
      }

      const resolved = await resolveAudioUrl(videoId.trim());
      if (!resolved) {
        return reply.status(404).send({ error: "Could not resolve audio for this video" });
      }

      return reply.send({
        audioUrl: resolved.audioUrl,
        source: resolved.source,
        title: resolved.title,
        duration: resolved.duration,
      });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  fastify.get("/stream/proxy", async (request, reply) => {
    try {
      const { url } = request.query as { url?: string };
      if (!url || url.trim().length === 0) {
        throw new BadRequestError("url is required");
      }

      let decodedUrl: string;
      try {
        decodedUrl = decodeURIComponent(url.trim());
      } catch {
        decodedUrl = url.trim();
      }

      if (!decodedUrl.startsWith("http://") && !decodedUrl.startsWith("https://")) {
        throw new BadRequestError("Invalid URL");
      }

      const rangeHeader = request.headers.range;

      await proxyAudioStream(decodedUrl, rangeHeader, reply);
    } catch (error) {
      if (!reply.sent) {
        return sendError(reply, error);
      }
    }
  });

  fastify.get("/stream/youtube/direct", async (request, reply) => {
    try {
      const { videoId } = request.query as { videoId?: string };
      if (!videoId || videoId.trim().length === 0) {
        throw new BadRequestError("videoId is required");
      }

      const resolved = await resolveAudioUrl(videoId.trim());
      if (!resolved) {
        return reply.status(404).send({ error: "Could not resolve audio for this video" });
      }

      const rangeHeader = request.headers.range;

      await proxyAudioStream(resolved.audioUrl, rangeHeader, reply);
    } catch (error) {
      if (!reply.sent) {
        return sendError(reply, error);
      }
    }
  });
}
