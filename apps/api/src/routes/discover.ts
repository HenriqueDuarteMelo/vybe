import type { FastifyInstance } from "fastify";
import * as discoverService from "../modules/discover/discover.service.js";
import { searchArchive } from "../modules/archive/archive.service.js";
import type { ArchiveTrack } from "../modules/archive/archive.service.js";
import { enrichFullOnly } from "../modules/enrichment/enrichment.service.js";
import { sendError, BadRequestError } from "../utils/errors.js";

// Deezer only offers 30s previews, so artist/album track lists are sourced from
// archive.org instead — the same place the search page already pulls full
// tracks from. Deezer still provides the artist/album metadata (name, art,
// discography) used to find the matching archive content.
function flatten(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

// Archive's creator search also returns names that merely contain the query
// ("Mournful Skank" for "Skank"), so keep only tracks whose artist actually
// is the requested act.
function artistMatches(
  trackArtist: string | null | undefined,
  requested: string
): boolean {
  const name = flatten(trackArtist);
  const key = flatten(requested);
  if (!name || !key) return false;
  return name === key || name.startsWith(key) || key.startsWith(name);
}

function filterByArtist(tracks: ArchiveTrack[], artistName: string): ArchiveTrack[] {
  const matched = tracks.filter((t) =>
    artistMatches(t.artist?.name, artistName)
  );
  return matched.length > 0 ? matched : tracks;
}

export async function discoverRoutes(fastify: FastifyInstance) {
  fastify.get("/discover/search", async (request, reply) => {
    try {
      const { q } = request.query as { q?: string };
      if (!q || q.trim().length === 0) {
        return reply.send({ tracks: [], artists: [], albums: [] });
      }
      const results = await discoverService.searchDeezer(q.trim());
      results.tracks = await enrichFullOnly(results.tracks);
      return reply.send(results);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  fastify.get("/discover/artist/:deezerId", async (request, reply) => {
    try {
      const { deezerId } = request.params as { deezerId: string };
      const id = deezerId.replace("deezer:", "");
      const artist = await discoverService.getDeezerArtist(id);
      const [albums, archiveResult] = await Promise.all([
        discoverService.getDeezerArtistAlbums(id),
        searchArchive(artist.name),
      ]);
      const topTracks = await enrichFullOnly(
        filterByArtist(archiveResult.tracks, artist.name)
      );
      return reply.send({ artist, topTracks, albums });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  fastify.get("/discover/album/:deezerId", async (request, reply) => {
    try {
      const { deezerId } = request.params as { deezerId: string };
      const id = deezerId.replace("deezer:", "");
      const album = await discoverService.getDeezerAlbum(id);

      // Prefer the artist's archive items whose album title matches this
      // release; if none match, fall back to the artist's archive tracks so the
      // page still plays complete songs instead of showing "No tracks".
      const artistName = album.artist?.name ?? "";
      let archiveTracks: ArchiveTrack[] = [];
      if (artistName) {
        const pool = filterByArtist(
          (await searchArchive(artistName)).tracks,
          artistName
        );
        const albumKey = flatten(album.title);
        const specific = albumKey
          ? pool.filter((t) => flatten(t.album?.title ?? "").includes(albumKey))
          : [];
        archiveTracks = specific.length > 0 ? specific : pool;
      }

      album.tracks = await enrichFullOnly(archiveTracks);
      return reply.send(album);
    } catch (error) {
      return sendError(reply, error);
    }
  });
}