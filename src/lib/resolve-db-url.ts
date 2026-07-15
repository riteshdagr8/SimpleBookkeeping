import path from "node:path";

/**
 * Rewrite relative SQLite `file:` URLs to absolute paths anchored at `process.cwd()`.
 *
 * Prisma resolves `file:./...` relative to the schema's directory, which is
 * different from the runtime cwd. The app expects the same `DATABASE_URL` to
 * resolve to the same file whether invoked via the Prisma CLI (cwd=prisma/),
 * a tsx script (cwd=project root), or the Next.js dev server (cwd=project root).
 *
 * Anchor relative paths to cwd so all entry points agree on the file location.
 */
export function resolveDatabaseUrl(raw: string): string {
  if (!raw.startsWith("file:")) return raw;
  const filePath = raw.slice("file:".length);
  if (path.isAbsolute(filePath)) return raw;
  return `file:${path.resolve(process.cwd(), filePath)}`;
}
