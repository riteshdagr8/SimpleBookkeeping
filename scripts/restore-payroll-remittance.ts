/**
 * Restore the database from a backup file, chosen by name.
 *
 *   npm run restore-payroll-remittance -- --list
 *   npm run restore-payroll-remittance -- --file=simplebookkeeping-20261120-000210.db
 *
 * --file is required and takes the file name only. Use the name printed by
 * `npm run remove-payroll-remittance`, or any hourly backup name from
 * `npm run backup`. Files are looked up in backups/pre-migration and backups/.
 *
 * Before anything is overwritten, the current database is saved to
 * backups/pre-migration, and the script prints that file's name. Restoring that
 * file later undoes this restore.
 *
 * Stop the app first. The script refuses to run while the app is listening on
 * its port.
 */

import "dotenv/config";
import { copyFileSync, existsSync, readdirSync, unlinkSync } from "fs";
import { basename, join, resolve } from "path";
import { createConnection } from "net";
import { resolveDatabaseUrl } from "../src/lib/resolve-db-url";
import { createBackupSnapshot } from "./lib/backup-snapshot";

const SEARCH_DIRS = ["backups/pre-migration", "backups"];
const APP_PORT = Number(process.env.PORT) || 3100;

interface BackupFile {
  name: string;
  dir: string;
}

function flagValue(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

function resolveDbPath(): string {
  // Same resolution as the app (src/lib/resolve-db-url.ts).
  const raw = process.env.DATABASE_URL ?? "file:../data/app.db";
  return resolveDatabaseUrl(raw).replace(/^file:/, "");
}

function availableBackups(): BackupFile[] {
  const found: BackupFile[] = [];
  for (const d of SEARCH_DIRS) {
    const dir = resolve(process.cwd(), d);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (name.startsWith("simplebookkeeping-") && name.endsWith(".db")) {
        found.push({ name, dir });
      }
    }
  }
  return found.sort((a, b) => a.name.localeCompare(b.name));
}

function printList(backups: BackupFile[]) {
  if (backups.length === 0) {
    console.log("No backups found in backups/pre-migration or backups/.");
    return;
  }
  for (const b of backups) console.log(`  ${b.name}    (${b.dir})`);
}

function appIsRunning(): Promise<boolean> {
  return new Promise((done) => {
    const socket = createConnection({ host: "127.0.0.1", port: APP_PORT });
    socket.setTimeout(1000);
    socket.once("connect", () => {
      socket.destroy();
      done(true);
    });
    socket.once("error", () => done(false));
    socket.once("timeout", () => {
      socket.destroy();
      done(false);
    });
  });
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function main() {
  const backups = availableBackups();

  if (process.argv.includes("--list")) {
    printList(backups);
    return;
  }

  const file = flagValue("file");
  if (!file) {
    console.error("--file=<name> is required. Available backups:\n");
    printList(backups);
    console.error("\nExample: npm run restore-payroll-remittance -- --file=<name>");
    process.exit(1);
  }
  if (file !== basename(file)) {
    fail("Give the file name only, not a path (for example --file=simplebookkeeping-20261120-000210.db).");
  }

  const matches = backups.filter((b) => b.name === file);
  if (matches.length === 0) {
    console.error(`No backup named "${file}" was found. Available backups:\n`);
    printList(backups);
    process.exit(1);
  }
  if (matches.length > 1) {
    fail(`"${file}" exists in more than one backup folder; remove the duplicate before restoring.`);
  }

  if (await appIsRunning()) {
    fail(`The app is running on port ${APP_PORT}. Stop it first (stop.cmd), then run this again.`);
  }

  const source = join(matches[0].dir, file);
  const dbPath = resolveDbPath();
  console.log(`Restore source : ${source}`);
  console.log(`Target         : ${dbPath}`);

  console.log("\nSaving the current database first, so this restore can be undone...");
  const safety = await createBackupSnapshot(undefined, `before-restore-of-${file}`);
  const safetyName = basename(safety.dbOut);
  console.log(`Current database saved as: ${safetyName}`);

  // Best-effort remove first, then copy, so the restore also works on Windows.
  try {
    unlinkSync(dbPath);
  } catch {
    // Copying below overwrites the file anyway.
  }
  copyFileSync(source, dbPath);

  const jsonSidecar = source.replace(/\.db$/, ".json");
  if (existsSync(jsonSidecar)) {
    try {
      copyFileSync(jsonSidecar, dbPath.replace(/\.db$/, ".db.bakmeta.json"));
    } catch {
      // The sidecar is informational only.
    }
  }

  console.log(`\nRestored ${file} into ${dbPath}.`);
  console.log(`\nTo undo this restore later (app stopped):\n  npm run restore-payroll-remittance -- --file=${safetyName}`);
  console.log("\nStart the app again to load the restored database.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
