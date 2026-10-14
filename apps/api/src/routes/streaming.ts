import type { FastifyInstance } from "fastify";
import {
  getTrackFilePath,
  getFileStats,
  parseRange,
  createFileStream,
  getContentType,
} from "../modules/streaming/streaming.service.js";
import { sendError } from "../utils/errors.js";

export async function streamingRoutes(fastify: FastifyInstance) {
  fastify.get("/tracks/:id/stream", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const filePath = await getTrackFilePath(id);
      const stat = getFileStats(filePath);
      const range = parseRange(request.headers.range, stat.size);
      const contentType = getContentType(filePath);

      if (range) {
        const stream = createFileStream(filePath, range);
        return reply
          .status(206)
          .header("Content-Type", contentType)
          .header("Content-Range", `bytes ${range.start}-${range.end}/${range.total}`)
          .header("Accept-Ranges", "bytes")
          .header("Content-Length", range.end - range.start + 1)
          .send(stream);
      }

      const stream = createFileStream(filePath, null);
      return reply
        .header("Content-Type", contentType)
        .header("Accept-Ranges", "bytes")
        .header("Content-Length", stat.size)
        .send(stream);
    } catch (error) {
      return sendError(reply, error);
    }
  });
}
