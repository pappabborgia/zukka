import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
const playOrigin = (process.env.NEXT_PUBLIC_PLAY_ORIGIN ?? "http://127.0.0.1:3001").replace(/\/$/, "");

/**
 * Policy for the main site. The key line for games is frame-src: this page may only
 * frame the games origin, and the browser applies it to every navigation of the game
 * iframe, so a game cannot send its own frame to another website.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  `frame-src ${playOrigin}`,
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  transpilePackages: ["@zukka/game-protocol", "@zukka/engines"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
