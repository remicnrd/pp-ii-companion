import type { NextConfig } from "next";

// BASE_PATH lets us host under e.g. https://<user>.github.io/<repo>/
// Set BASE_PATH=/personal-power-ii at build time. Empty in dev.
const basePath = process.env.BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: basePath || undefined,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_APP_PASSWORD_HASH: process.env.NEXT_PUBLIC_APP_PASSWORD_HASH || "",
  },
};

export default nextConfig;
