import { z } from "zod";
import { resolveDatabaseUrl } from "@/lib/resolve-db-url";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  NEXTAUTH_SECRET: z.string().min(16, "NEXTAUTH_SECRET must be at least 16 characters"),
  // Optional: when unset, NextAuth and email links derive the base URL from the
  // incoming request, so the app works regardless of host name or port.
  NEXTAUTH_URL: z.string().url().optional(),
  // Explicit public origin (scheme://host) used for absolute links (e.g. the
  // password-reset email). Set this when the app is behind a Cloudflare tunnel
  // or reverse proxy that rewrites the Host header to localhost.
  PUBLIC_BASE_URL: z.string().url().optional(),
  APP_DATA_KEY: z.string().optional(),
  BACKUP_DIR: z.string().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const resolved = {
    ...process.env,
    DATABASE_URL: resolveDatabaseUrl(process.env.DATABASE_URL ?? ""),
  };
  const parsed = envSchema.safeParse(resolved);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

