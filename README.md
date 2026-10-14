# VYBE

Music streaming platform. Music that moves you.

Modern, dark, premium listening experience — with its own identity and architecture
(inspired by general streaming UX patterns, not a copy of any existing product).

## Architecture

npm-workspaces monorepo:

```
VYBE/
├── apps/
│   ├── api/       Fastify + Prisma + PostgreSQL REST API + HTTP streaming
│   └── web/       React + Vite + TypeScript SPA (Zustand, Tailwind, React Router)
├── packages/
│   └── shared/    Shared TypeScript types used by api and web
├── docker-compose.yml   PostgreSQL 16 for development
└── package.json         Workspace root scripts
```

- **Frontend**: React 19, Vite 6, React Router, Zustand (state), Tailwind CSS, lucide-react.
- **Backend**: Node.js, Fastify 5, Prisma 6, PostgreSQL 16.
- **Streaming**: real HTTP streaming with `Range` request support (seek, progressive
  playback). Storage is abstracted behind `getTrackFilePath` in
  `apps/api/src/modules/streaming/streaming.service.ts`, so it can later be swapped for
  S3 / Cloudflare R2 without rewriting the API.
- **Auth**: JWT (`jsonwebtoken`), bcrypt password hashing (12 rounds), route-level
  middleware (`fastify.authenticate`), ownership checks for playlists.
- **State**: player state is centralized in the Zustand `playerStore` and survives
  navigation; a single `HTMLAudioElement` is reused for all playback.

## Requirements

- Node.js >= 20
- npm >= 10
- Docker + Docker Compose (for PostgreSQL)

## Setup

**Windows (recommended):**

```powershell
npm install
.\dev.ps1 -Seed     # first run: Docker + PostgreSQL + schema + catalog
.\dev.ps1           # afterwards: starts whatever is not running yet
```

`dev.bat` is the same launcher (double-click). It opens two windows —
`VYBE API` (`:3001`) and `VYBE WEB` (`:5173`) — and skips anything already up.

**Manual:**

```bash
# 1. Install dependencies (monorepo)
npm install

# 2. Start PostgreSQL (port 5433 on the host)
docker compose up -d

# 3. Configure environment
cp .env.example .env            # root example for reference
# apps/api/.env already exists for development. Adjust if needed.

# 4. Apply migrations + seed
npm run db:push                 # sync schema
npm run db:seed                 # fictional catalog + dev user + audio files

# 5. Run both apps
npm run dev                     # API on :3001, web on :5173
```

Open http://localhost:5173 and log in with the development account:

```
Email:    adm
Password: adm1
```

> Legacy seed account also available: `dev@vybe.com` / `password123`.

## Environment variables

| Variable           | Description                                          | Default                        |
| ------------------ | ---------------------------------------------------- | ------------------------------ |
| `DATABASE_URL`     | PostgreSQL connection string (dev)                  | `postgresql://vybe:vybe@localhost:5433/vybe?schema=public` |
| `TEST_DATABASE_URL`| PostgreSQL connection string (tests)                | `postgresql://vybe:vybe@localhost:5433/vybe_test?schema=public` |
| `JWT_SECRET`       | Secret used to sign tokens                          | `dev-secret` (change in prod)  |
| `JWT_EXPIRES_IN`   | Token lifetime                                      | `7d`                           |
| `PORT`             | API port                                            | `3001`                         |
| `HOST`             | API bind address                                    | `0.0.0.0`                      |
| `WEB_URL`          | Allowed CORS origin (frontend)                      | `http://localhost:5173`        |
| `UPLOAD_DIR`       | Local directory that holds audio files              | `./uploads`                    |

Never commit real secrets. `.env` files are gitignored.

## Database

Schema lives in `apps/api/prisma/schema.prisma`. Entities:

`User`, `Artist`, `Album`, `Track`, `Genre`, `Playlist`, `PlaylistTrack`, `Favorite`,
`ListeningHistory`.

Design decisions:

- UUID primary keys (`uuid()`).
- FKs with `onDelete: Cascade` where deletion of a parent must clean up children
  (e.g., a deleted user removes playlists/favorites/history; a deleted artist removes
  its albums and tracks).
- Composite unique constraints to prevent duplicates:
  - `PlaylistTrack`: unique `(playlistId, trackId)` — one track once per playlist,
    with a `position` column for ordering.
  - `Favorite`: unique `(userId, trackId)` — one favorite per track per user.
- `User.email` and `User.username` unique.
- Indexes on foreign keys (`artistId`, `albumId`, `userId`, `playlistId`, `trackId`)
  and on `(userId, playedAt)` for history queries.

### Migrations

```bash
npm run db:migrate   # create/apply migration in dev
npm run db:push      # push schema without a migration file
```

### Seed

```bash
npm run db:seed
```

Creates a fictional catalog (16 artists, 19 albums, 114 tracks, 16 genres), a dev
user, a starter playlist, favorites, and generates 8-bit PCM WAV audio files for every
track locally (synthesized tones — no copyrighted music). Files land in
`apps/api/uploads/` (gitignored).

## API

All routes are prefixed with `/api`. Authenticated routes require
`Authorization: Bearer <token>`.

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| POST   | `/api/auth/register` | – | Create account |
| POST   | `/api/auth/login` | – | Login, returns token |
| GET    | `/api/auth/me` | ✓ | Current user profile |
| GET    | `/api/tracks` | – | List tracks (page/limit/genreId/artistId/albumId) |
| GET    | `/api/tracks/:id` | – | Track detail |
| GET    | `/api/tracks/:id/stream` | – | HTTP streaming (Range support) |
| POST   | `/api/tracks` | ✓ | Upload a track (multipart audio + metadata) |
| POST   | `/api/tracks/:id/favorite` | ✓ | Favorite a track |
| DELETE | `/api/tracks/:id/favorite` | ✓ | Unfavorite a track |
| GET    | `/api/tracks/:id/favorite/status` | ✓ | Favorite status |
| GET    | `/api/artists` | – | List artists (paginated) |
| GET    | `/api/artists/:id` | – | Artist detail with albums |
| GET    | `/api/artists/:id/top-tracks` | – | Artist popular tracks |
| GET    | `/api/albums` | – | List albums (paginated) |
| GET    | `/api/albums/:id` | – | Album detail with tracks |
| GET    | `/api/genres` | – | List genres |
| GET    | `/api/search?q=` | – | Search tracks/artists/albums/genres |
| GET    | `/api/favorites` | ✓ | User favorites |
| GET    | `/api/playlists` | ✓ | User playlists |
| POST   | `/api/playlists` | ✓ | Create playlist |
| GET    | `/api/playlists/:id` | – | Playlist detail |
| PUT    | `/api/playlists/:id` | ✓ | Rename / update playlist |
| DELETE | `/api/playlists/:id` | ✓ | Delete playlist |
| POST   | `/api/playlists/:id/tracks` | ✓ | Add track |
| DELETE | `/api/playlists/:id/tracks/:trackId` | ✓ | Remove track |
| PUT    | `/api/playlists/:id/reorder` | ✓ | Reorder tracks |
| GET    | `/api/history` | ✓ | Listening history (paginated) |
| POST   | `/api/history` | ✓ | Record a play |
| GET    | `/api/health` | – | Health check |

Errors follow a consistent shape: `{ "error": "<message>", "code": "<CODE>" }` with
appropriate HTTP status codes (400/401/403/404/409/500). Stack traces are never
returned to clients.

### Search

`GET /api/search?q=` merges several sources and returns at most 30 tracks:

1. **Local catalog** (PostgreSQL) — always included and ranked first; a match in
   the user's own library can never be crowded out by external results.
2. **Deezer** (current catalog + artist top tracks by popularity) — results are
   ranked by relevance and each source keeps its native order on ties, so an
   artist's top tracks surface in popularity order instead of alphabetically.
3. **Archive.org** — only kept when they actually match the query
   (artist/title/album/genre score). Archive results are filtered to real music
   (podcasts/interviews excluded) and creator-strict when the query resolves to
   an artist.
4. Short queries (`cbjr`, `tpain`) are resolved through MusicBrainz to the
   canonical artist name before scoring, so nicknames still match.
5. **Full-audio enrichment** — Deezer only serves 30s previews, so before
   returning, each streaming track (top 10) is matched against Archive.org for
   the same song and gets a full-length `audioUrl` when a real match exists.
   Matching is strict on purpose: both titles must reduce to the same core
   (album numbers, artists, `CD/track` prefixes and edition labels stripped),
   carry the same version markers (live/acoustic/remix/demo), sit within
   10%/20s duration of each other, and the artist must appear on one side —
   so `2 + 2 = 5 (Live)` never steals the audio URL of `You (Live)` and
   live/acoustic renditions keep their own version. Tribute/karaoke/cover
   items are dropped; duplicate rows of the same song (Deezer + Archive)
   collapse to one line before the cap. The player prefers `audioUrl` over
   `previewUrl`, so matched tracks play end-to-end through
   `/api/stream/proxy` (Range-capable); the rest keep the preview. Lookups are
   cached (incl. negative) and capped by a hard time budget so search latency
   is unaffected.

#### Outbound relay (`utils/relay.ts`)

Corporate firewalls often block catalog/media hosts (`api.deezer.com`,
`*.dzcdn.net`, …) at the connection/SNI level. All external lookups go through
`relayJson()`, which tries the **direct route first** and then falls back to
public relay services (`allorigins.hexlet.app`, `r.jina.ai`) that fetch the URL
from their own network. A caller-supplied plausibility check rejects bodies
that parse fine but are degraded (relays occasionally serve stale/corrupt
cached copies — e.g. a search reporting `total=192` with a single item), so the
next relay is tried instead of returning garbage. `r.jina.ai` rejects
browser-like User-Agents with `403`, so it is called with its own client
headers and unwrapped from its Markdown preamble. Responses are cached per-URL
(5–30 min) and concurrent identical requests are deduplicated, keeping
search-as-you-type within relay rate limits. Deezer artwork is rewritten to
`wsrv.nl` (image proxy) and blocked audio previews are fetched through the
relay, cached in memory, and served with local Range support
(`youtubeProxy.service.ts`).

### Streaming

`GET /api/tracks/:id/stream` implements HTTP Range Requests:

- `200` with `Content-Length` + `Accept-Ranges: bytes` for full requests.
- `206 Partial Content` with `Content-Range` and partial `Content-Length` for
  `Range: bytes=...` requests.
- Correct `Content-Type` per file extension (`audio/mpeg`, `audio/wav`, ...).

Browsers use this for progressive playback, seeking, and large files.

### Uploading audio (`POST /api/tracks`)

Authenticated, `multipart/form-data` only:

| Field        | Type   | Required | Notes                                   |
| ------------ | ------ | -------- | --------------------------------------- |
| `audio`      | file   | yes      | `< 50 MB`. Allowed: mp3, wav, ogg, flac, aac, m4a, webm |
| `title`      | string | yes      | 1–200 chars                             |
| `artistId`   | uuid   | yes      |                                         |
| `albumId`    | uuid   | yes      | Must belong to `artistId` (rejected otherwise) |
| `genreIds`   | string | no       | JSON array of genre ids                  |
| `trackNumber`| string | no       | Integer                                 |
| `duration`   | string | no       | Seconds. Auto-detected from WAV headers when omitted |

Security details:

- Filename extension is derived from the **declared MIME type** allowlist, never from user
  input; files are stored under a server-generated UUID name, so no path traversal or
  arbitrary file access is possible.
- File size is capped server-side (50 MB).
- The saved file is deleted if any later validation step fails (offending albums/genres,
  schema errors) so no orphaned files remain.
- After upload, tracks stream automatically through the existing Range endpoint.

## Frontend

Routes:

- `/` Home
- `/search` Search (debounced, filters per content type, genre browsing)
- `/library` User playlists
- `/playlist/:id` Playlist detail
- `/liked` Liked songs
- `/artist/:id` Artist page
- `/album/:id` Album page
- `/history` Listening history
- `/upload` Add a track (audio file + metadata)
- `/login`, `/register` Auth pages

Player (persistent bottom bar):

- Play / pause, next / previous, seek bar, volume, queue panel
- Shuffle and repeat (off / all / one)
- Single shared `HTMLAudioElement`, state survives navigation
- History recording is throttled server-side (one entry per track per 30s)
- Playlist tracks can be reordered with drag-and-drop (owner only)

## Testing

```bash
npm run test          # all workspaces
npm run test --workspace=apps/api    # API integration + unit tests
npm run test --workspace=apps/web    # player logic unit tests
```

Coverage:

- Auth: register, duplicate email, weak password, login, wrong password, profile,
  unauthenticated access, password hashing.
- Playlists: create, add track, remove track, cross-user authorization (403).
- Favorites: favorite, list, unfavorite.
- Search: results and empty-query handling.
- Streaming: 206/range parsing unit tests + missing-file/404 behavior.
- Track upload: valid WAV upload creates the track (duration auto-detected), unsupported
  MIME rejected, missing file rejected, unauthenticated rejected, album/artist mismatch
  rejected (and the saved file cleaned up).
- Player logic: next/prev index rules (shuffle, repeat, end-of-queue),
  remove-from-queue and index bookkeeping, duration formatting.

API tests run against a **separate** database (`vybe_test`, created and migrated
automatically in the vitest global setup) so development data is never touched.

## Scripts

Root `package.json`:

- `npm run dev` — API + web in parallel
- `npm run build` — build all workspaces
- `npm run start` — production start (API serves the built SPA on `:3001`)
- `npm run typecheck` — type-check all workspaces
- `npm run lint` — lint (if present)
- `npm run test` — run all tests
- `npm run db:migrate` / `db:push` / `db:seed` / `db:reset`

## Security notes

- Passwords hashed with bcrypt (cost 12); never stored in plain text.
- JWT in `Authorization` header; no secrets in the codebase.
- Zod validation on all request bodies (register, login, playlists).
- CORS restricted to `WEB_URL`.
- Playlist mutations verify the requester owns the playlist.
- Streaming rejects non-existent tracks and missing/bad range headers; file serving
  is limited to `UPLOAD_DIR` (no path traversal, no arbitrary file access).
- Consistent error responses — no stack traces leak in production.

## Production

```bash
npm run build     # tsc (api) + vite build (web)
npm start         # cross-env NODE_ENV=production node dist/server.js
```

One process then serves everything on a single port:

- `GET /` and any non-API route → the built SPA (`apps/web/dist`), with SPA
  fallback so client-side routes (`/search`, `/playlist/:id`, …) survive refresh.
- `/api/*` → the REST API, unchanged.
- `GET /api/health` → `{ "status": "ok" }` for uptime checks / load balancers.
- Graceful shutdown on `SIGINT`/`SIGTERM` (in-flight requests finish, then exit).

Checklist before deploying:

- [ ] `JWT_SECRET` set to a strong random value (never the dev default).
- [ ] `WEB_URL` set to the public origin of the frontend (CORS).
- [ ] `DATABASE_URL` pointing at the production PostgreSQL; run `npx prisma migrate deploy`.
- [ ] `UPLOAD_DIR` on persistent storage (or swap `streaming.service.ts` for S3/R2).

## Roadmap highlights (design decisions)

- Storage layer is isolated in `streaming.service.ts`; replacing the local filesystem
  with S3/R2 only requires changing that module (fetch the object and pipe it).
- Player shuffle/repeat rules live in pure functions (`apps/web/src/lib/playerLogic.ts`)
  so they are unit-testable and framework-agnostic.
- Fictional seed catalog + locally synthesized audio files avoid any copyrighted
  material; legally obtained audio can be added later by pointing `Track.audioUrl`
  at files in the upload directory.