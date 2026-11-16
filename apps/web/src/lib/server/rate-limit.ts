import "server-only";
import { createHash } from "node:crypto";
import { db } from "./firebase";

/**
 * Fixed-window counters in Firestore (collection "rateLimits"). Keys are hashed, so no email
 * or IP address is stored in clear. Returns false when the limit is reached.
 * A TTL policy on "expiresAt" (set in the Firebase console) removes old windows.
 */
export async function hit(bucket: string, key: string, limit: number, windowSeconds: number, now = Date.now()): Promise<boolean> {
  const window = Math.floor(now / 1000 / windowSeconds);
  const id = createHash("sha256").update(`${bucket}|${key}|${window}`).digest("hex").slice(0, 40);
  const ref = db().collection("rateLimits").doc(id);
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const count = (snap.exists ? (snap.get("count") as number) : 0) + 1;
    if (count > limit) return false;
    tx.set(ref, { bucket, count, expiresAt: new Date((window + 1) * windowSeconds * 1000) });
    return true;
  });
}

export const LIMITS = {
  /** sign-in emails per address */
  loginPerEmail: { limit: 5, windowSeconds: 3600 },
  /** sign-in emails per IP address */
  loginPerIp: { limit: 20, windowSeconds: 3600 },
  /** finishing a sign-in, per IP */
  finishPerIp: { limit: 30, windowSeconds: 3600 },
  /** PIN attempts per IP (on top of the lock on each account) */
  pinPerIp: { limit: 30, windowSeconds: 3600 },
} as const;
