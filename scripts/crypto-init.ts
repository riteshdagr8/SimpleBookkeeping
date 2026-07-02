/**
 * Generates a 32-byte base64 APP_DATA_KEY and appends to .env if missing.
 *
 * Usage:
 *   npx tsx scripts/crypto-init.ts
 *   npx tsx scripts/crypto-init.ts --force   (overwrite existing value)
 */

import "dotenv/config";
import { randomBytes } from "crypto";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

function parseArgs() {
  return { force: process.argv.includes("--force") };
}

function main() {
  const { force } = parseArgs();
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) {
    console.error(`.env not found at ${envPath}. Copy .env.example first.`);
    process.exit(1);
  }
  const content = readFileSync(envPath, "utf8");
  const has = /^APP_DATA_KEY="?([^\n"]*)"?$/m.exec(content);
  const existing = has?.[1]?.trim() ?? "";
  if (existing && !force) {
    console.log("APP_DATA_KEY already set. Pass --force to overwrite.");
    return;
  }
  const key = randomBytes(32).toString("base64");
  let next = content;
  if (has) {
    next = content.replace(/^APP_DATA_KEY=.*$/m, `APP_DATA_KEY="${key}"`);
  } else {
    next = content.replace(/\n?$/, `\nAPP_DATA_KEY="${key}"\n`);
  }
  writeFileSync(envPath, next, "utf8");
  console.log(`APP_DATA_KEY ${existing && force ? "regenerated" : "set"} (${key.length} chars base64).`);
}

main();
