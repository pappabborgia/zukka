import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { sessionSecret } from "./env";

/**
 * Small signed tokens for Zukka's own cookies: base64url(JSON) + "." + HMAC-SHA256.
 * Every token has a purpose and an expiry, so one kind cannot be used as another.
 */
function mac(purpose: string, body: string, secret: string): string {
  return createHmac("sha256", secret).update(`${purpose}.${body}`).digest("base64url");
}

export function signToken(purpose: string, data: Record<string, unknown>, ttlSeconds: number, secret = sessionSecret()): string {
  const body = Buffer.from(JSON.stringify({ ...data, exp: Math.floor(Date.now() / 1000) + ttlSeconds })).toString("base64url");
  return `${body}.${mac(purpose, body, secret)}`;
}

export function verifyToken<T extends Record<string, unknown>>(
  purpose: string,
  token: string | undefined,
  secret = sessionSecret(),
): T | null {
  if (!token || token.length > 2000) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = Buffer.from(mac(purpose, body, secret));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T & { exp?: number };
    if (typeof data.exp !== "number" || data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}
