/**
 * Restore a SimpleBookkeeping backup.
 *
 * Usage:
 *   npx tsx scripts/restore.ts            # interactive picker
 *   npx tsx scripts/restore.ts --list     # list backups
 *   npx tsx scripts/restore.ts --pick=3   # non-interactive pick
 *
 * Before running, STOP the SimpleBookkeeping app so the DB file is not
 * locked. The script will print a reminder.
 */

import "dotenv/config";
import { existsSync, readdirSync, statSync, copyFileSync, unlinkSync } from "fs";
import { isAbsolute, join, resolve } from "path";
import { format } from "date-fns";

function parseArgs() {
  const argv = process.argv.slice(2);
  let outputDir = process.env.BACKUP_DIR?.trim() || "";
  let pick: number | null = null;
  let listOnly = false;
  for (const a of argv) {
    if (a.startsWith("--output=")) outputDir = a.slice("--output=".length);
    else if (a.startsWith("--pick=")) pick = Number(a.slice("--pick=".length));
    else if (a === "--list") listOnly = true;
  }
  if (!outputDir) outputDir = resolve(process.cwd(), "backups");
  return { outputDir: isAbsolute(outputDir) ? outputDir : resolve(process.cwd(), outputDir), pick, listOnly };
}

function resolveDbPath(): string {
  const raw = process.env.DATABASE_URL ?? "file:./data/app.db";
  const stripped = raw.replace(/^file:/, "").replace(/^\/+/, "");
  if (!isAbsolute(stripped)) {
    return resolve(process.cwd(), stripped);
  }
  return stripped;
}

function listBackups(outputDir: string) {
  if (!existsSync(outputDir)) return [];
  return readdirSync(outputDir)
    .filter((f) => f.startsWith("simplebookkeeping-") && f.endsWith(".db"))
    .map((f) => {
      const full = join(outputDir, f);
      const m = /simplebookkeeping-(\d{8})-(\d{4})\.db/.exec(f);
      if (!m) return null;
      const isoTs = `${m[1].slice(0, 4)}-${m[1].slice(4, 6)}-${m[1].slice(6, 8)}T${m[2].slice(0, 2)}:${m[2].slice(2, 4)}:00Z`;
      return { file: f, full, ts: new Date(isoTs), bytes: statSync(full).size };
    })
    .filter((x): x is { file: string; full: string; ts: Date; bytes: number } => !!x)
    .sort((a, b) => b.ts.getTime() - a.ts.getTime());
}

async function prompt(question: string): Promise<string> {
  process.stdout.write(question);
  return new Promise((resolve) => {
    const onData = (chunk: Buffer) => {
      const s = chunk.toString("utf8").trim();
      process.stdin.removeListener("data", onData);
      process.stdin.pause();
      resolve(s);
    };
    process.stdin.resume();
    process.stdin.once("data", onData);
  });
}

async function main() {
  const { outputDir, pick, listOnly } = parseArgs();
  const backups = listBackups(outputDir);
  if (backups.length === 0) {
    console.log("No backups found in", outputDir);
    return;
  }

  if (listOnly) {
    console.log(`# ${backups.length} backup(s) in ${outputDir}`);
    backups.forEach((b, i) => {
      console.log(`${String(i + 1).padStart(3, " ")}  ${format(b.ts, "yyyy-MM-dd HH:mm")}  ${b.bytes} B  ${b.file}`);
    });
    return;
  }

  console.log(`# ${backups.length} backup(s) in ${outputDir}`);
  backups.forEach((b, i) => {
    console.log(`${String(i + 1).padStart(3, " ")}  ${format(b.ts, "yyyy-MM-dd HH:mm")}  ${b.bytes} B  ${b.file}`);
  });

  let index: number;
  if (pick !== null && !Number.isNaN(pick)) {
    index = pick - 1;
  } else {
    const ans = await prompt(`\nPick a backup to restore (1-${backups.length}) or q to quit: `);
    if (ans === "q" || ans === "") {
      console.log("Aborted.");
      return;
    }
    index = Number(ans) - 1;
  }
  if (index < 0 || index >= backups.length) {
    console.error("Invalid selection.");
    process.exit(1);
  }

  const chosen = backups[index];
  const dbPath = resolveDbPath();

  console.log(`\nSource : ${chosen.full}`);
  console.log(`Target : ${dbPath}`);
  console.log("\nSTOP the SimpleBookkeeping app before continuing.");

  const confirm = await prompt(`Type YES to overwrite ${dbPath} with this backup: `);
  if (confirm !== "YES") {
    console.log("Aborted.");
    return;
  }

  // If the live DB is open, removing it may fail on Windows. Best-effort remove first.
  try {
    unlinkSync(dbPath);
  } catch (e) {
    // ignore — copyFileSync below will overwrite byte-for-byte anyway.
  }
  copyFileSync(chosen.full, dbPath);
  const jsonSidecar = chosen.full.replace(/\.db$/, ".json");
  if (existsSync(jsonSidecar)) {
    try {
      copyFileSync(jsonSidecar, dbPath.replace(/\.db$/, ".db.bakmeta.json"));
    } catch {
      // best-effort
    }
  }
  console.log("\nRestored. Restart the SimpleBookkeeping app to load the new database.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
