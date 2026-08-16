/**
 * Shared one-off snapshot logic: a consistent offline copy of the live SQLite
 * DB via the sqlite3 CLI (`VACUUM INTO`), falling back to Prisma's
 * `$executeRawUnsafe("VACUUM INTO ...")`. Used by scripts/backup.ts and by
 * scripts/migrate-multi-entity.ts (which must back up before any write).
 */

import { execFileSync, spawnSync } from "child_process";
import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { isAbsolute, join, resolve } from "path";
import { format } from "date-fns";
import { resolveDatabaseUrl } from "../../src/lib/resolve-db-url";

function resolveDbPath(): string {
  const raw = process.env.DATABASE_URL ?? "file:../data/app.db";
  return resolveDatabaseUrl(raw).replace(/^file:/, "");
}

function sqliteCliAvailable(): boolean {
  const r = spawnSync("sqlite3", ["--version"], { stdio: "ignore" });
  return r.status === 0;
}

function backupWithCli(dbPath: string, outPath: string) {
  const safeOut = outPath.replace(/'/g, "''");
  execFileSync(
    "sqlite3",
    [dbPath, "PRAGMA busy_timeout=5000;", `.timeout 5000`, `VACUUM INTO '${safeOut}'`],
    { stdio: "pipe" }
  );
}

async function backupWithPrisma(dbPath: string, outPath: string) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient({ log: ["error"] });
  const safeOut = outPath.replace(/'/g, "''");
  try {
    await prisma.$executeRawUnsafe(`VACUUM INTO '${safeOut}'`);
  } finally {
    await prisma.$disconnect();
  }
}

function sha256OfFile(p: string): string {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

export interface SnapshotResult {
  dbPath: string;
  dbOut: string;
  metaOut: string;
  outputDir: string;
}

/**
 * Create one offline snapshot. Defaults to `<cwd>/backups/pre-migration` so a
 * migration snapshot never collides with, or gets pruned by, the hourly
 * backup retention in scripts/backup.ts. Returns the created paths.
 */
export async function createBackupSnapshot(
  outputDir?: string,
  note = "snapshot"
): Promise<SnapshotResult> {
  const raw = outputDir || process.env.BACKUP_DIR?.trim() || "backups/pre-migration";
  const resolvedOut = isAbsolute(raw) ? raw : resolve(process.cwd(), raw);
  if (!existsSync(resolvedOut)) mkdirSync(resolvedOut, { recursive: true });

  const dbPath = resolveDbPath();
  if (!existsSync(dbPath)) throw new Error(`Database not found at ${dbPath}`);

  const now = new Date();
  const baseName = `simplebookkeeping-${format(now, "yyyyMMdd-HHmmss")}`;
  const dbOut = join(resolvedOut, `${baseName}.db`);
  const metaOut = join(resolvedOut, `${baseName}.json`);

  console.log(`[snapshot] Source: ${dbPath}`);
  console.log(`[snapshot] Output: ${resolvedOut}`);

  if (sqliteCliAvailable()) {
    console.log("[snapshot] Using sqlite3 CLI");
    backupWithCli(dbPath, dbOut);
  } else {
    console.log("[snapshot] sqlite3 CLI not on PATH; using Prisma VACUUM INTO");
    await backupWithPrisma(dbPath, dbOut);
  }

  if (!existsSync(dbOut)) throw new Error(`Snapshot was not created at ${dbOut}`);

  writeFileSync(
    metaOut,
    JSON.stringify(
      { takenAt: now.toISOString(), dbSha256: sha256OfFile(dbOut), schemaVersion: 1, note },
      null,
      2
    ),
    "utf8"
  );

  console.log(`[snapshot] wrote ${dbOut}`);
  return { dbPath, dbOut, metaOut, outputDir: resolvedOut };
}
