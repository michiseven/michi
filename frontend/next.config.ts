import type { NextConfig } from "next";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const frontendDirectory = dirname(fileURLToPath(import.meta.url));
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");

const nextConfig: NextConfig = {
  agentRules: false,
  basePath,
  output: "standalone",
  outputFileTracingRoot: resolve(frontendDirectory, ".."),
  poweredByHeader: false,
  transpilePackages: ["@michi/log-friends-sdk"],
  turbopack: { root: resolve(frontendDirectory, "..") },
};

export default nextConfig;
