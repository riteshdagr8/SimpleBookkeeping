/**
 * AES-256-GCM symmetric encryption for at-rest secrets.
 *
 * Storage format: `v1:<ivB64u>:<tagB64u>:<ctB64u>` (versioned so we can rotate later).
 * Key source: APP_DATA_KEY env var, base64 of 32 raw bytes.
 *
 * Run `npm run crypto-init` to generate a key.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { env } from "@/lib/env";

const VERSION = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;

function getKey(): Buffer {
  const raw = env().APP_DATA_KEY;
  if (!raw) {
    throw new Error(
      "APP_DATA_KEY is not set. Run `npm run crypto-init` to generate one, then restart the app."
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      `APP_DATA_KEY must decode to 32 bytes (got ${key.length}). Run \`npm run crypto-init -- --force\`.`
    );
  }
  return key;
}

function b64uEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64uDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, b64uEncode(iv), b64uEncode(tag), b64uEncode(ct)].join(":");
}

export function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Invalid ciphertext format");
  }
  const key = getKey();
  const iv = b64uDecode(parts[1]);
  const tag = b64uDecode(parts[2]);
  const ct = b64uDecode(parts[3]);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}

export function isEncryptedFormat(value: string | null | undefined): boolean {
  return !!value && value.startsWith("v1:") && value.split(":").length === 4;
}
