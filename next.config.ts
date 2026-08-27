import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  async rewrites() {
    return [{
      source: "/api/v1/:path*",
      destination: `${process.env.BFF_INTERNAL_URL ?? "http://localhost:8080"}/api/v1/:path*`,
    }];
  },
};

export default nextConfig;
