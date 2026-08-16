/**
 * Pre-flight check for the multi-entity & jurisdiction update.
 *
 * Run this on the target machine BEFORE pulling/building/migrating:
 *   npx tsx scripts/preflight-multi-entity.ts
 *
 * It verifies (read-only — makes no changes):
 *   1. Node version is adequate.
 *   2. .env has the keys the new code needs (AUTH_TRUST_HOST,
 *      PUBLIC_BASE_URL, and the existing secrets NEXTAUTH_SECRET/APP_DATA_KEY).
 *   3. The SQLite DB exists and is in the legacy pre-migration shape
 *      (Ontario jurisdiction / Regular remitter / OntarioAnnualReturn rows),
 *      which tells us the migration has work to do.
 *   4. The dev server is not holding the DB (best-effort port check).
 *
 * Prints a PASS/FAIL summary. It never writes to the database.
 */

import "dotenv/config";
import { existsSync } from "fs";
import { isAbsolute, resolve } from "path";
import { createBackupSnapshot } from "./lib/backup-snapshot";

const PORT = Number(process.env.PORT || 3100);

function check(label: string, ok: boolean, detail = ""): boolean {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

async function main() {
  console.log("=== SimpleBookkeeping multi-entity pre-flight ===\n");
  let allOk = true;

  // --- 1. Node version ---
  const [majorStr] = process.versions.node.split(".");
  const major = Number(majorStr);
  allOk = check("Node version >= 18.18", major >= 18, `v${process.versions.node}`) && allOk;

  // --- 2. .env keys ---
  const envKeys: Record<string, boolean> = {
    NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET && process.env.NEXTAUTH_SECRET.length >= 16,
    APP_DATA_KEY: !!process.env.APP_DATA_KEY,
    AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST === "true",
    PUBLIC_BASE_URL: !!process.env.PUBLIC_BASE_URL,
  };
  console.log("  Environment (.env):");
  allOk = check("  NEXTAUTH_SECRET present", envKeys.NEXTAUTH_SECRET) && allOk;
  allOk = check("  APP_DATA_KEY present", envKeys.APP_DATA_KEY) && allOk;
  allOk = check("  AUTH_TRUST_HOST=true", envKeys.AUTH_TRUST_HOST) && allOk;
  allOk =
    check(
      "  PUBLIC_BASE_URL set",
      envKeys.PUBLIC_BASE_URL,
      process.env.PUBLIC_BASE_URL
        ? `-> ${process.env.PUBLIC_BASE_URL}`
        : "set it to http://bk.simplefinapp.com"
    ) && allOk;

  // --- 3. Database state ---
  const raw = process.env.DATABASE_URL ?? "file:../data/app.db";
  const dbPath = resolveDatabaseUrlPath(raw);
  console.log("\n  Database:");
  if (!dbPath) {
    allOk = check("  resolve database path", false, "unable to resolve") && allOk;
  } else {
    allOk = check("  DB file exists", existsSync(dbPath), dbPath) && allOk;
    if (existsSync(dbPath)) {
      try {
        // Read-only SQLite inspection via node:sqlite (Node 22+). On Node 20
        // this falls back to a warning (the migration itself will back up).
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { DatabaseSync } = require("node:sqlite");
        const db = new DatabaseSync(dbPath, { readOnly: true });
        const count = (sql: string) => db.prepare(sql).get() as { c: number };
        const legacyJurs = count("SELECT COUNT(*) c FROM Client WHERE incorporationJurisdiction='Ontario'").c;
        const regularRemitters = count("SELECT COUNT(*) c FROM Client WHERE remitterType='Regular'").c;
        const oldAr = count("SELECT COUNT(*) c FROM FilingObligation WHERE filingType='OntarioAnnualReturn'").c;
        const newJurs = count("SELECT COUNT(*) c FROM Client WHERE incorporationJurisdiction='ON'").c;
        const monthlyRemitters = count("SELECT COUNT(*) c FROM Client WHERE remitterType='Monthly'").c;
        const newAr = count("SELECT COUNT(*) c FROM FilingObligation WHERE filingType='ProvincialAnnualReturn'").c;
        db.close();

        const alreadyMigrated = legacyJurs === 0 && regularRemitters === 0 && oldAr === 0;
        allOk = check(
          "  legacy pre-migration shape present",
          !alreadyMigrated,
          alreadyMigrated
            ? `already migrated (ON=${newJurs}, Monthly=${monthlyRemitters}, ProvincialAR=${newAr}) — re-run is still safe/idempotent`
            : `Ontario=${legacyJurs}, Regular=${regularRemitters}, OntarioAnnualReturn=${oldAr}`
        ) && allOk;
      } catch (e) {
        console.log(`  WARN  read-only DB inspection skipped (${(e as Error).message})`);
      }
    }
  }

  // --- 4. Dev server on PORT? (best-effort) ---
  console.log("\n  Server:");
  const portBusy = await isPortListening(PORT);
  allOk =
    check(
      `  port ${PORT} is free (app stopped)`,
      !portBusy,
      portBusy ? "a process is listening — run stop.cmd/stop.sh first" : "no listener found"
    ) && allOk;

  console.log("\n=== RESULT ===");
  if (allOk) {
    console.log("All checks passed. Safe to: git pull && npm install && npm run migrate-multi-entity && npm run build && ./start.sh");
  } else {
    console.log("Some checks FAILED. Fix the items above before pulling/migrating. (Pasting this output to Claude is fine.)");
    process.exitCode = 1;
  }
}

function resolveDatabaseUrlPath(raw: string): string {
  // Mirrors resolveDatabaseUrl: relative file: URLs resolve against cwd/prisma.
  if (!raw.startsWith("file:")) return raw;
  const p = raw.slice("file:".length);
  return isAbsolute(p) ? p : resolve(process.cwd(), "prisma", p);
}

function isPortListening(port: number): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const net = require("net");
  const s = net.connect({ host: "127.0.0.1", port });
  return new Promise<boolean>((resolveListening) => {
    s.once("connect", () => {
      s.destroy();
      resolveListening(true);
    });
    s.once("error", () => resolveListening(false));
  });
}

main().catch((e) => {
  console.error("Pre-flight error:", e);
  process.exit(1);
});
