import type { NextConfig } from "next";

/**
 * The games origin. It serves only game documents (/g/<id>), each with its own strict
 * headers (see src/app/g/[id]/route.ts). Everything else here is locked down too.
 */
const nextConfig: NextConfig = {
  poweredByHeader: false,
  transpilePackages: ["@zukka/game-protocol"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
