/**
 * Security headers for every game document served from the games origin.
 * They apply even if someone opens a game URL directly, outside the iframe.
 */
export function gameContentSecurityPolicy(frameAncestors: string[]): string {
  const ancestors = frameAncestors.length ? frameAncestors.join(" ") : "'none'";
  return [
    "default-src 'none'", // nothing that is not listed below: no fetch, XHR, WebSocket, workers, frames, objects
    "script-src 'unsafe-inline'", // inline scripts only; no external files, no eval()
    "style-src 'unsafe-inline'",
    "img-src data: blob:",
    "font-src data:",
    "media-src data: blob:",
    "connect-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
    "manifest-src 'none'",
    "worker-src 'none'",
    "frame-src 'none'",
    "object-src 'none'",
    `frame-ancestors ${ancestors}`,
    "sandbox allow-scripts", // same sandbox as the iframe attribute, also when opened directly
  ].join("; ");
}

export const GAME_PERMISSIONS_POLICY = [
  "accelerometer=()",
  "camera=()",
  "display-capture=()",
  "geolocation=()",
  "gyroscope=()",
  "microphone=()",
  "midi=()",
  "payment=()",
  "usb=()",
  "serial=()",
  "bluetooth=()",
  "clipboard-read=()",
  "clipboard-write=()",
  "publickey-credentials-get=()",
  "screen-wake-lock=()",
  "xr-spatial-tracking=()",
].join(", ");

export function gameResponseHeaders(opts: { frameAncestors: string[]; cacheSeconds?: number }): Record<string, string> {
  return {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Security-Policy": gameContentSecurityPolicy(opts.frameAncestors),
    "Permissions-Policy": GAME_PERMISSIONS_POLICY,
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "Cross-Origin-Opener-Policy": "same-origin",
    "X-Robots-Tag": "noindex, nofollow",
    "Cache-Control": `public, max-age=${opts.cacheSeconds ?? 300}`,
  };
}
