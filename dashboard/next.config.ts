import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits .next/standalone with a self-contained server.js and only the
  // node_modules actually reached at runtime, so the Docker image doesn't
  // need the full dependency tree. Harmless for `next dev`.
  output: "standalone",
};

export default nextConfig;
