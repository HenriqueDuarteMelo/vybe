import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { prisma } from "../src/utils/prisma.js";
import { buildApp } from "../src/app.js";
import { hashPassword } from "../src/utils/auth.js";
import { removeUploadedAudio } from "../src/modules/tracks/upload.service.js";

let app: FastifyInstance;

const testUser = {
  email: "test_auth@vybe.test",
  username: "test_auth_user",
  password: "testpassword123",
};

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await prisma.$disconnect();
  await app.close();
});

afterEach(async () => {
  await prisma.listeningHistory.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.playlistTrack.deleteMany();
  await prisma.playlist.deleteMany();
  await prisma.user.deleteMany({
    where: { email: { endsWith: "@vybe.test" } },
  });
  await prisma.artist.deleteMany({
    where: {
      name: {
        in: ["Test Artist", "Stream Artist", "Upload Artist", "Demo Artist", "Remote Artist"],
      },
    },
  });
  await prisma.genre.deleteMany({
    where: {
      name: { in: ["Upload Genre"] },
    },
  });
});

describe("Auth", () => {
  it("registers a new user", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: testUser,
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.user.email).toBe(testUser.email);
    expect(body.token).toBeDefined();
  });

  it("rejects duplicate email registration", async () => {
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: testUser,
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: testUser,
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe("CONFLICT");
  });

  it("rejects weak passwords", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "weak@vybe.test", username: "weak_user", password: "123" },
    });

    expect(res.statusCode).toBe(400);
  });

  it("logs in with valid credentials", async () => {
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: testUser,
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: testUser.email, password: testUser.password },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().token).toBeDefined();
  });

  it("rejects login with wrong password", async () => {
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: testUser,
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: testUser.email, password: "wrong-password" },
    });

    expect(res.statusCode).toBe(400);
  });

  it("returns profile for authenticated requests", async () => {
    const reg = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: testUser,
    });
    const token = reg.json().token;

    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().email).toBe(testUser.email);
  });

  it("returns 401 for unauthenticated profile requests", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
    });

    expect(res.statusCode).toBe(401);
  });
});

async function createUserWithToken(): Promise<{ userId: string; token: string }> {
  const reg = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: testUser,
  });
  const body = reg.json();
  return { userId: body.user.id, token: body.token };
}

async function seedTrack(): Promise<{ id: string; title: string }> {
  const artist = await prisma.artist.create({ data: { name: "Test Artist" } });
  const album = await prisma.album.create({
    data: { title: "Test Album", artistId: artist.id },
  });
  const track = await prisma.track.create({
    data: {
      title: "Test Track",
      duration: 200,
      artistId: artist.id,
      albumId: album.id,
      // Search only returns tracks that can play completely; a local track
      // without its audio file would be hidden.
      audioUrl: "test-track.mp3",
    },
  });
  return { id: track.id, title: track.title };
}

describe("Playlists", () => {
  it("creates a playlist", async () => {
    const { token } = await createUserWithToken();

    const res = await app.inject({
      method: "POST",
      url: "/api/playlists",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "My Test Playlist" },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().name).toBe("My Test Playlist");
  });

  it("adds a track to a playlist", async () => {
    const { token } = await createUserWithToken();
    const track = await seedTrack();

    const createRes = await app.inject({
      method: "POST",
      url: "/api/playlists",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Playlist" },
    });
    const playlistId = createRes.json().id;

    const addRes = await app.inject({
      method: "POST",
      url: `/api/playlists/${playlistId}/tracks`,
      headers: { authorization: `Bearer ${token}` },
      payload: { trackId: track.id },
    });

    expect(addRes.statusCode).toBe(201);
    expect(addRes.json().track.title).toBe("Test Track");
  });

  it("imports a remote track when adding to a playlist", async () => {
    const { token } = await createUserWithToken();

    const createRes = await app.inject({
      method: "POST",
      url: "/api/playlists",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Remote Playlist" },
    });
    const playlistId = createRes.json().id;

    const remoteId = "archive:demo2:02-demo.mp3";
    const addRes = await app.inject({
      method: "POST",
      url: `/api/playlists/${playlistId}/tracks`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        trackId: remoteId,
        track: {
          id: remoteId,
          title: "Remote Add",
          duration: 180,
          audioUrl: "https://archive.org/download/demo2/02-demo.mp3",
          artistId: "archive:artist:demo2",
          artistName: "Remote Artist",
          albumId: "archive:album:demo2",
          albumTitle: "Remote Album",
        },
      },
    });

    expect(addRes.statusCode).toBe(201);
    expect(addRes.json().track.title).toBe("Remote Add");
  });

  it("removes a track from a playlist", async () => {
    const { token } = await createUserWithToken();
    const track = await seedTrack();

    const createRes = await app.inject({
      method: "POST",
      url: "/api/playlists",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Playlist" },
    });
    const playlistId = createRes.json().id;

    await app.inject({
      method: "POST",
      url: `/api/playlists/${playlistId}/tracks`,
      headers: { authorization: `Bearer ${token}` },
      payload: { trackId: track.id },
    });

    const removeRes = await app.inject({
      method: "DELETE",
      url: `/api/playlists/${playlistId}/tracks/${track.id}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(removeRes.statusCode).toBe(204);

    const getRes = await app.inject({
      method: "GET",
      url: `/api/playlists/${playlistId}`,
    });
    expect(getRes.json().tracks).toHaveLength(0);
  });

  it("denies adding to another user's playlist", async () => {
    const { token } = await createUserWithToken();
    const track = await seedTrack();

    const createRes = await app.inject({
      method: "POST",
      url: "/api/playlists",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Private" },
    });
    const playlistId = createRes.json().id;

    const otherUser = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "other@vybe.test",
        username: "other_user",
        password: "otherpassword1",
      },
    });
    const otherToken = otherUser.json().token;

    const res = await app.inject({
      method: "POST",
      url: `/api/playlists/${playlistId}/tracks`,
      headers: { authorization: `Bearer ${otherToken}` },
      payload: { trackId: track.id },
    });

    expect(res.statusCode).toBe(403);
  });
});

describe("Favorites", () => {
  it("favorites and lists a track", async () => {
    const { token } = await createUserWithToken();
    const track = await seedTrack();

    const favRes = await app.inject({
      method: "POST",
      url: `/api/tracks/${track.id}/favorite`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(favRes.statusCode).toBe(201);

    const listRes = await app.inject({
      method: "GET",
      url: "/api/favorites",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(listRes.json()).toHaveLength(1);
    expect(listRes.json()[0].track.id).toBe(track.id);
  });

  it("unfavorites a track", async () => {
    const { token } = await createUserWithToken();
    const track = await seedTrack();

    await app.inject({
      method: "POST",
      url: `/api/tracks/${track.id}/favorite`,
      headers: { authorization: `Bearer ${token}` },
    });

    const removeRes = await app.inject({
      method: "DELETE",
      url: `/api/tracks/${track.id}/favorite`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(removeRes.statusCode).toBe(204);

    const listRes = await app.inject({
      method: "GET",
      url: "/api/favorites",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(listRes.json()).toHaveLength(0);
  });

  it("imports a remote track when favoriting", async () => {
    const { token } = await createUserWithToken();

    const remoteId = "archive:demo:01%20-%20Demo%20Song.mp3";
    const favRes = await app.inject({
      method: "POST",
      url: `/api/tracks/${encodeURIComponent(remoteId)}/favorite`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        track: {
          id: remoteId,
          title: "Demo Song",
          duration: 200,
          audioUrl: "https://archive.org/download/demo/01-demo.mp3",
          artistId: "archive:artist:demo",
          artistName: "Demo Artist",
          albumId: "archive:album:demo",
          albumTitle: "Demo Album",
        },
      },
    });

    expect(favRes.statusCode).toBe(201);

    const listRes = await app.inject({
      method: "GET",
      url: "/api/favorites",
      headers: { authorization: `Bearer ${token}` },
    });
    const favorites = listRes.json();
    expect(favorites).toHaveLength(1);
    expect(favorites[0].track.title).toBe("Demo Song");
    expect(favorites[0].track.audioUrl).toBe(
      "https://archive.org/download/demo/01-demo.mp3"
    );
    expect(favorites[0].track.artist.name).toBe("Demo Artist");
  });
});

describe("Search", () => {
  it("searches tracks, artists and albums", async () => {
    const track = await seedTrack();

    const res = await app.inject({
      method: "GET",
      url: `/api/search?q=${encodeURIComponent(track.title)}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.tracks.some((t: { id: string }) => t.id === track.id)).toBe(true);
  });

  it("returns empty results for an empty query", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/search?q=",
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ top: null, tracks: [], artists: [], albums: [], genres: [] });
  });
});

describe("Streaming", () => {
  it("returns 404 (not a stack trace) for a missing audio file", async () => {
    const artist = await prisma.artist.create({
      data: { name: "Stream Artist" },
    });
    const album = await prisma.album.create({
      data: { title: "Stream Album", artistId: artist.id },
    });
    const track = await prisma.track.create({
      data: {
        title: "Stream Track",
        duration: 60,
        audioUrl: "missing-file.wav",
        artistId: artist.id,
        albumId: album.id,
      },
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/tracks/${track.id}/stream`,
      headers: { range: "bytes=0-99" },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("NOT_FOUND");
    expect(res.body).not.toContain("at ");
  });

  it("returns 404 for a non-existent track", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/tracks/00000000-0000-0000-0000-000000000000/stream",
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("NOT_FOUND");
  });
});

describe("Password hashing", () => {
  it("hashes passwords (never stores plain text)", async () => {
    const hashed = await hashPassword("secret-password");
    expect(hashed).not.toBe("secret-password");
    expect(hashed.length).toBeGreaterThan(20);
  });
});

function wavBuffer(seconds = 1): Buffer {
  const sampleRate = 11025;
  const dataSize = sampleRate * seconds;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate, 28);
  buf.writeUInt16LE(1, 32);
  buf.writeUInt16LE(8, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  return buf;
}

function multipartBody(
  fields: [string, string][],
  file?: { name: string; mime: string; buffer: Buffer }
): { body: Buffer; contentType: string } {
  const boundary = "----VybeTestBoundary";
  const CRLF = "\r\n";
  const chunks: Buffer[] = [];
  for (const [key, value] of fields) {
    chunks.push(
      Buffer.from(
        `--${boundary}${CRLF}Content-Disposition: form-data; name="${key}"${CRLF}${CRLF}${value}${CRLF}`
      )
    );
  }
  if (file) {
    chunks.push(
      Buffer.from(
        `--${boundary}${CRLF}Content-Disposition: form-data; name="audio"; filename="${file.name}"${CRLF}Content-Type: ${file.mime}${CRLF}${CRLF}`
      )
    );
    chunks.push(file.buffer);
    chunks.push(Buffer.from(CRLF));
  }
  chunks.push(Buffer.from(`--${boundary}--${CRLF}`));
  return { body: Buffer.concat(chunks), contentType: `multipart/form-data; boundary=${boundary}` };
}

describe("Track upload", () => {
  async function seedUploadArtist() {
    const artist = await prisma.artist.create({ data: { name: "Upload Artist" } });
    const album = await prisma.album.create({
      data: { title: "Upload Album", artistId: artist.id },
    });
    const genre = await prisma.genre.create({ data: { name: "Upload Genre" } });
    return { artist, album, genre };
  }

  it("uploads an audio file and creates the track", async () => {
    const { token } = await createUserWithToken();
    const { artist, album, genre } = await seedUploadArtist();
    const { body, contentType } = multipartBody(
      [
        ["title", "Uploaded Song"],
        ["artistId", artist.id],
        ["albumId", album.id],
        ["genreIds", JSON.stringify([genre.id])],
        ["trackNumber", "1"],
      ],
      { name: "track.wav", mime: "audio/wav", buffer: wavBuffer(2) }
    );

    const res = await app.inject({
      method: "POST",
      url: "/api/tracks",
      headers: { authorization: `Bearer ${token}`, "content-type": contentType },
      payload: body,
    });

    expect(res.statusCode).toBe(201);
    const track = res.json();
    expect(track.title).toBe("Uploaded Song");
    expect(track.audioUrl).toMatch(/\.wav$/);
    expect(track.duration).toBe(2);
    expect(track.genres.some((g: { id: string }) => g.id === genre.id)).toBe(true);

    await prisma.track.delete({ where: { id: track.id } });
    removeUploadedAudio(track.audioUrl);
  });

  it("rejects unsupported file types", async () => {
    const { token } = await createUserWithToken();
    const { artist, album } = await seedUploadArtist();
    const { body, contentType } = multipartBody(
      [
        ["title", "Hacked"],
        ["artistId", artist.id],
        ["albumId", album.id],
      ],
      { name: "evil.exe", mime: "text/plain", buffer: Buffer.from("MZ") }
    );

    const res = await app.inject({
      method: "POST",
      url: "/api/tracks",
      headers: { authorization: `Bearer ${token}`, "content-type": contentType },
      payload: body,
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("BAD_REQUEST");
  });

  it("rejects uploads without a file", async () => {
    const { token } = await createUserWithToken();
    const { artist, album } = await seedUploadArtist();
    const { body, contentType } = multipartBody([
      ["title", "No File"],
      ["artistId", artist.id],
      ["albumId", album.id],
    ]);

    const res = await app.inject({
      method: "POST",
      url: "/api/tracks",
      headers: { authorization: `Bearer ${token}`, "content-type": contentType },
      payload: body,
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("BAD_REQUEST");
  });

  it("rejects uploads without authentication", async () => {
    const { artist, album } = await seedUploadArtist();
    const { body, contentType } = multipartBody(
      [["title", "No Auth"], ["artistId", artist.id], ["albumId", album.id]],
      { name: "track.wav", mime: "audio/wav", buffer: wavBuffer() }
    );

    const res = await app.inject({
      method: "POST",
      url: "/api/tracks",
      headers: { "content-type": contentType },
      payload: body,
    });

    expect(res.statusCode).toBe(401);
  });

  it("rejects an album that belongs to another artist and cleans up the file", async () => {
    const { token } = await createUserWithToken();
    const { artist, album } = await seedUploadArtist();
    const otherArtist = await prisma.artist.create({ data: { name: "Other Upload Artist" } });
    const { body, contentType } = multipartBody(
      [
        ["title", "Mismatched"],
        ["artistId", otherArtist.id],
        ["albumId", album.id],
      ],
      { name: "track.wav", mime: "audio/wav", buffer: wavBuffer() }
    );

    const res = await app.inject({
      method: "POST",
      url: "/api/tracks",
      headers: { authorization: `Bearer ${token}`, "content-type": contentType },
      payload: body,
    });

    expect(res.statusCode).toBe(400);

    await prisma.artist.deleteMany({
      where: { name: { in: ["Other Upload Artist"] } },
    });
    const leftovers = await prisma.track.count({ where: { title: "Mismatched" } });
    expect(leftovers).toBe(0);
  });
});