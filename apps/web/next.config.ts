import { existsSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { resolve } from "node:path";
import type { NextConfig } from "next";

const rootEnv = resolve(__dirname, "../../.env");
if (existsSync(rootEnv)) {
  process.loadEnvFile(rootEnv);
}

const apiOrigin = (
  process.env.HASUT_API_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:3001"
)
  .replace("://localhost", "://127.0.0.1")
  .replace(/\/$/, "");

function allowedDevOrigins(): string[] {
  const hosts = new Set(["localhost", "127.0.0.1", "::1"]);
  for (const addrs of Object.values(networkInterfaces())) {
    for (const addr of addrs ?? []) {
      const family = String(addr.family);
      if (!addr.internal && (family === "IPv4" || family === "4")) {
        hosts.add(addr.address);
      }
    }
  }
  return [...hosts];
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  allowedDevOrigins: allowedDevOrigins(),
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiOrigin}/api/:path*`,
      },
    ];
  },
  transpilePackages: [
    "@hasut/ui",
    "@hasut/api-client",
    "@hasut/config",
    "@hasut/types",
    "@hasut/auth",
    "@hasut/utils",
    "@hasut/validation",
  ],
};

export default nextConfig;
