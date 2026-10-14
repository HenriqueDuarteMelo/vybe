import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { existsSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { authPlugin } from "./plugins/auth.js";
import { authRoutes } from "./routes/auth.js";
import { trackRoutes } from "./routes/tracks.js";
import { streamingRoutes } from "./routes/streaming.js";
import { artistRoutes } from "./routes/artists.js";
import { albumRoutes } from "./routes/albums.js";
import { searchRoutes } from "./routes/search.js";
import { playlistRoutes } from "./routes/playlists.js";
import { favoriteRoutes } from "./routes/favorites.js";
import { historyRoutes } from "./routes/history.js";
import { genreRoutes } from "./routes/genres.js";
import { discoverRoutes } from "./routes/discover.js";
import { youtubeRoutes } from "./routes/youtube.js";
import { remoteRoutes } from "./routes/remote.js";
import { archiveRoutes } from "./routes/archive.js";
import { audioProxyRoutes } from "./routes/audioProxy.js";

export async function buildApp() {
  const app = Fastify({
    logger: process.env.NODE_ENV === "test" ? false : { level: "info" },
    maxParamLength: 2048,
  });

  // WEB_URL accepts a comma-separated list of allowed origins (e.g. the Vercel
  // production URL plus preview URLs), or "*" to allow any origin. Locally it
  // stays http://localhost:5173.
  const webOrigins = (process.env.WEB_URL || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  await app.register(cors, {
    origin: webOrigins.includes("*") ? true : webOrigins,
    credentials: true,
  });

  await app.register(multipart, {
    limits: {
      files: 1,
      fileSize: 50 * 1024 * 1024,
    },
  });

  await authPlugin(app);

  await app.register(authRoutes, { prefix: "/api" });
  await app.register(trackRoutes, { prefix: "/api" });
  await app.register(streamingRoutes, { prefix: "/api" });
  await app.register(artistRoutes, { prefix: "/api" });
  await app.register(albumRoutes, { prefix: "/api" });
  await app.register(searchRoutes, { prefix: "/api" });
  await app.register(playlistRoutes, { prefix: "/api" });
  await app.register(favoriteRoutes, { prefix: "/api" });
  await app.register(historyRoutes, { prefix: "/api" });
  await app.register(genreRoutes, { prefix: "/api" });
  await app.register(discoverRoutes, { prefix: "/api" });
  await app.register(youtubeRoutes, { prefix: "/api" });
  await app.register(remoteRoutes, { prefix: "/api" });
  await app.register(archiveRoutes, { prefix: "/api" });
  await app.register(audioProxyRoutes, { prefix: "/api" });

  app.get("/api/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

  // In production a single process serves the API and the built SPA (npm run
  // build + npm start). Dev mode keeps the Vite server as the entry point.
  const here = dirname(fileURLToPath(import.meta.url));
  const webDist = resolve(here, "..", "..", "web", "dist");
  const serveWeb =
    process.env.NODE_ENV === "production" && existsSync(join(webDist, "index.html"));

  if (serveWeb) {
    await app.register(fastifyStatic, { root: webDist, prefix: "/" });
  }

  app.setNotFoundHandler((request, reply) => {
    const path = request.url.split("?")[0];
    if (serveWeb && path !== "/api" && !path.startsWith("/api/") && extname(path) === "") {
      return reply.sendFile("index.html");
    }
    return reply.status(404).send({
      error: `Route ${request.method}:${request.url} not found`,
      code: "NOT_FOUND",
    });
  });

  return app;
}