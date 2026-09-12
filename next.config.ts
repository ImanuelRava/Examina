import type { NextConfig } from "next";

// `standalone` output is only for self-hosting (Docker/Node server).
// On Vercel it must be disabled so Vercel's own build output tracing is used.
const isVercel = !!process.env.VERCEL;

const nextConfig: NextConfig = {
  ...(isVercel ? {} : { output: "standalone" as const }),
  // Keep the Prisma query engine outside the bundler so its native
  // binaries resolve correctly on serverless functions.
  serverExternalPackages: ["@prisma/client"],
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
