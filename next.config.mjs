import path from "node:path";
import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Produce a minimal `standalone` server bundle for containerized deploys.
  output: "standalone",
  // Anchor file tracing to the project root even when the repo is checked out
  // inside a larger directory tree (e.g. /home/ritesh/code/SimpleBookKeeping),
  // which silences Next's "inferred workspace root" warning.
  outputFileTracingRoot: path.dirname(fileURLToPath(import.meta.url)),
};

export default nextConfig;
