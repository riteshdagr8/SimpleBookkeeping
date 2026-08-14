/**
 * SQLite backup script for SimpleBookkeeping.
 *
 * Produces a consistent snapshot of the live database using the
 * `sqlite3` CLI's `.timeout` and `VACUUM INTO` commands.
 *
 * Retention:
 *   - All hourly snapshots within the last 7 days are kept.
 *   - Snapshots older than 7 days: keep only the most recent file per UTC day.
 *
 * Prerequisites:
 *   - The `sqlite3` CLI must be on PATH. On Windows, install from
 *     https://www.sqlite.org/download.html (sqlite-tools-win-x64).
 *
 * Usage:
 *   npx tsx scripts/backup.ts
 *   npx tsx scripts/backup.ts --output=D:\backups\simpleBookkeeping
 *
 * Scheduling (Windows Task Scheduler):
 *   Program:   npx
 *   Arguments: tsx W:\claude\simpleBookkeeping\scripts\backup.ts
 *   Start in:  W:\claude\simpleBookkeeping
 *   Trigger:   Every 1 hour
 */

import "dotenv/config";
import { execFileSync, spawnSync } from "child_process";
import { createHash } from "crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { isAbsolute, join, resolve } from "path";
import { format } from "date-fns";
import { resolveDatabaseUrl } from "../src/lib/resolve-db-url";

interface Args {
  outputDir: string;
  force: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  let outputDir = process.env.BACKUP_DIR?.trim() || "";
  let force = false;
  for (const a of argv) {
    if (a.startsWith("--output=")) outputDir = a.slice("--output=".length);
    else if (a === "--force") force = true;
  }
  if (!outputDir) outputDir = resolve(process.cwd(), "backups");
  return {
    outputDir: isAbsolute(outputDir) ? outputDir : resolve(process.cwd(), outputDir),
    force,
  };
}

function resolveDbPath(): string {
  // Use the same resolution as the runtime (src/lib/resolve-db-url.ts) so a
  // relative `file:../data/app.db` from .env resolves to the same file the
  // app uses (cwd/prisma base), not <cwd-parent>/data/app.db.
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

function backupWithPrisma(dbPath: string, outPath: string) {
  // Use Prisma's connection to VACUUM INTO. This avoids needing the sqlite3 CLI.
  // The prisma client for SQLite is a thin wrapper over libsql / better-sqlite3.
  // We open a separate connection to run the backup so the app's main client is undisturbed.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient({ log: ["error"] });
  const safeOut = outPath.replace(/'/g, "''");
  return prisma
    .$executeRawUnsafe(`VACUUM INTO '${safeOut}'`)
    .then(() => prisma.$disconnect())
    .catch(async (e: unknown) => {
      await prisma.$disconnect();
      throw e;
    });
}

function sha256OfFile(p: string): string {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

async function main() {
  const { outputDir, force } = parseArgs();
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

  const dbPath = resolveDbPath();
  if (!existsSync(dbPath)) {
    console.error(`[backup] Database not found at ${dbPath}`);
    process.exit(1);
  }

  const now = new Date();
  const ts = format(now, "yyyyMMdd-HHmm");
  const baseName = `simplebookkeeping-${ts}`;
  const dbOut = join(outputDir, `${baseName}.db`);
  const metaOut = join(outputDir, `${baseName}.json`);

  console.log(`[backup] Source: ${dbPath}`);
  console.log(`[backup] Output: ${outputDir}`);

  if (existsSync(dbOut) && !force) {
    console.error(`[backup] Target ${dbOut} already exists. Re-run with --force to overwrite.`);
    process.exit(1);
  }

  try {
    if (sqliteCliAvailable()) {
      console.log("[backup] Using sqlite3 CLI");
      backupWithCli(dbPath, dbOut);
    } else {
      console.log("[backup] sqlite3 CLI not on PATH; using Prisma VACUUM INTO");
      await backupWithPrisma(dbPath, dbOut);
    }
  } catch (e) {
    console.error("[backup] Backup failed:", e);
    process.exit(1);
  }

  if (!existsSync(dbOut)) {
    console.error(`[backup] Expected ${dbOut} was not created.`);
    process.exit(1);
  }

  const sha = sha256OfFile(dbOut);
  writeFileSync(
    metaOut,
    JSON.stringify({ takenAt: now.toISOString(), dbSha256: sha, schemaVersion: 1 }, null, 2),
    "utf8"
  );

  let kept = 0;
  let pruned = 0;
  const all = readdirSync(outputDir)
    .filter((f) => f.startsWith("simplebookkeeping-") && f.endsWith(".db"))
    .map((f) => {
      const full = join(outputDir, f);
      const m = /simplebookkeeping-(\d{8})-(\d{4})\.db/.exec(f);
      if (!m) return null;
      const fileTs = new Date(
        `${m[1].slice(0, 4)}-${m[1].slice(4, 6)}-${m[1].slice(6, 8)}T${m[2].slice(0, 2)}:${m[2].slice(2, 4)}:00Z`
      );
      return { file: f, full, ts: fileTs };
    })
    .filter((x): x is { file: string; full: string; ts: Date } => !!x);

  const horizon = now.getTime() - 7 * 24 * 3600 * 1000;
  const keep = new Set<string>();
  const older = new Map<string, { file: string; full: string; ts: Date }[]>();

  for (const e of all) {
    if (e.ts.getTime() >= horizon) {
      keep.add(e.file);
    } else {
      const day = format(e.ts, "yyyy-MM-dd");
      const list = older.get(day) ?? [];
      list.push(e);
      older.set(day, list);
    }
  }
  for (const [, list] of older) {
    list.sort((a, b) => b.ts.getTime() - a.ts.getTime());
    if (list[0]) keep.add(list[0].file);
  }

  for (const e of all) {
    if (keep.has(e.file)) {
      kept++;
    } else {
      try {
        unlinkSync(e.full);
        const sidecar = e.full.replace(/\.db$/, ".json");
        if (existsSync(sidecar)) unlinkSync(sidecar);
        pruned++;
      } catch (err) {
        console.warn(`[backup] Failed to prune ${e.file}:`, err);
      }
    }
  }

  console.log(`[backup] wrote 1 | kept ${kept} | pruned ${pruned}`);
}

main().catch((e) => {
  console.error("[backup] Fatal:", e);
  process.exit(1);
});

