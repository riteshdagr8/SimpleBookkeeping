// Production-only path rewriting. Imported from src/instrumentation.ts so
// Node's fs/path APIs stay out of the webpack dev bundle.
import fs from "node:fs";
import path from "node:path";

/**
 * Anchor a path to the project root when running under .next/standalone.
 * `output: "standalone"` does not bundle `package.json` into the standalone
 * directory, so we use `prisma/schema.prisma` (which the Dockerfile copies
 * in) as a stable marker.
 */
function findProjectRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, "prisma", "schema.prisma"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  dir = start;
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, "package.json"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

/**
 * Rewrite `DATABASE_URL` if it points to a relative path. Prisma resolves
 * `file:./...` URLs relative to the schema location, which is fine in dev
 * but wrong under .next/standalone where the schema dir is missing.
 */
export function rewriteRelativeFileUrl(): void {
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("file:./")) return;
  const filePath = url.slice("file:".length);
  if (path.isAbsolute(filePath)) return;
  const root = findProjectRoot(process.cwd());
  process.env.DATABASE_URL = `file:${path.resolve(root, filePath)}`;
}
