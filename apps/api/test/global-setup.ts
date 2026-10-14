import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const prismaDir = join(__dirname, "..");
const schemaPath = join(prismaDir, "prisma", "schema.prisma");

const DB_NAME = "vybe_test";
const DB_URL =
  process.env.TEST_DATABASE_URL ||
  `postgresql://vybe:vybe@localhost:5433/${DB_NAME}?schema=public`;

function prismaBin(): string {
  const base = join(
    __dirname,
    "..",
    "..",
    "..",
    "node_modules",
    ".bin",
    "prisma"
  );
  return process.platform === "win32" ? `${base}.cmd` : base;
}

export async function setup() {
  const exists = execSync(
    `docker exec vybe-postgres psql -U vybe -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'"`
  )
    .toString()
    .trim();

  if (exists !== "1") {
    execSync(`docker exec vybe-postgres psql -U vybe -c "CREATE DATABASE ${DB_NAME}"`, {
      stdio: "pipe",
    });
    console.log(`[tests] created database ${DB_NAME}`);
  }

  console.log(`[tests] applying migrations to ${DB_NAME}`);
  execSync(`"${prismaBin()}" migrate deploy --schema "${schemaPath}"`, {
    env: { ...process.env, DATABASE_URL: DB_URL },
    cwd: prismaDir,
    stdio: "inherit",
  });
}

export function testDatabaseUrl(): string {
  return DB_URL;
}