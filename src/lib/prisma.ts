import path from "node:path";
import { PrismaClient } from "@prisma/client";

/**
 * Prisma resolves `file:./...` URLs relative to the schema's directory.
 * Rewrite relative SQLite paths to absolute paths anchored at process.cwd()
 * so the same DATABASE_URL works in dev, standalone, and Docker.
 */
function resolveDatabaseUrl(raw: string): string {
  if (!raw.startsWith("file:")) return raw;
  const filePath = raw.slice("file:".length);
  if (path.isAbsolute(filePath)) return raw;
  return `file:${path.resolve(process.cwd(), filePath)}`;
}

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = resolveDatabaseUrl(process.env.DATABASE_URL);
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
