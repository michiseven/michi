import type { NextConfig } from "next";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

const frontendDirectory = dirname(fileURLToPath(import.meta.url));
const rootEnvironmentFile = resolve(frontendDirectory, "../.env");

if (existsSync(rootEnvironmentFile)) {
  loadEnvFile(rootEnvironmentFile);
}

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
