/**
 * Origins allowed to embed games (CSP frame-ancestors). Comma separated.
 * Example: MAIN_ORIGINS=https://zukka.vercel.app
 */
export function allowedParentOrigins(): string[] {
  const raw = process.env.MAIN_ORIGINS ?? (process.env.NODE_ENV === "production" ? "" : "http://localhost:3000");
  return raw
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter((s) => /^https?:\/\/[a-z0-9.-]+(:\d+)?$/i.test(s));
}
