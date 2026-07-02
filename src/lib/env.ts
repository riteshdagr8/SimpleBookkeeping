import path from "node:path";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  NEXTAUTH_SECRET: z.string().min(16, "NEXTAUTH_SECRET must be at least 16 characters"),
  NEXTAUTH_URL: z.string().url().default("http://localhost:3000"),
  APP_DATA_KEY: z.string().optional(),
  BACKUP_DIR: z.string().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/**
 * Prisma resolves `file:./...` URLs relative to the schema's directory, not
 * the CWD. That makes the database file path move when running from
 * .next/standalone, dev, or a packaged container. We rewrite such relative
 * paths to absolute paths anchored at process.cwd() so the same DATABASE_URL
 * works everywhere.
 */
function resolveDatabaseUrl(raw: string): string {
  if (!raw.startsWith("file:")) return raw;
  const filePath = raw.slice("file:".length);
  if (path.isAbsolute(filePath)) return raw;
  return `file:${path.resolve(process.cwd(), filePath)}`;
}

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

