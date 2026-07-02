// Next.js runs this file once at server startup, before any route is
// loaded. It's the right place to fix up environment variables that other
// libraries read at import time (Prisma reads DATABASE_URL at construction).
//
// Only runs in production. Dev mode runs from the project root so the
// relative `file:./data/app.db` resolves correctly, and we don't want
// webpack to bundle node:fs into the dev hot-reload graph.

export async function register() {
  if (process.env.NODE_ENV === "production") {
    const { rewriteRelativeFileUrl } = await import("./lib/paths");
    rewriteRelativeFileUrl();
  }
}

