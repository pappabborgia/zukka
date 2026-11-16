import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { secureCookies } from "./env";
import { adminAuth } from "./firebase";
import { signToken, verifyToken } from "./signed";

/**
 * Three cookies, all httpOnly and SameSite=Lax:
 * - zk_session: the parent's Firebase session cookie (14 days)
 * - zk_player:  which child profile is playing on this device (signed, tied to the account)
 * - zk_parent:  the parent area is unlocked (signed, 15 minutes)
 * Plus zk_pending: the email address waiting for its sign-in link (signed, 1 hour).
 */
export const SESSION_COOKIE = "zk_session";
export const PLAYER_COOKIE = "zk_player";
export const PARENT_COOKIE = "zk_parent";
export const PENDING_COOKIE = "zk_pending";

export const SESSION_DAYS = 14;
export const PARENT_UNLOCK_MINUTES = 15;

const base = () => ({ httpOnly: true, sameSite: "lax" as const, secure: secureCookies(), path: "/" });

/** The signed-in parent's account id, or null. Checked against Firebase on every request. */
export const currentUid = cache(async (): Promise<string | null> => {
  const c = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!c) return null;
  try {
    const decoded = await adminAuth().verifySessionCookie(c, true);
    return decoded.uid;
  } catch {
    return null;
  }
});

export async function requireUid(next = "/"): Promise<string> {
  const uid = await currentUid();
  if (!uid) redirect(`/login?next=${encodeURIComponent(next)}`);
  return uid;
}

/** Creates the session from a fresh ID token. Only accepts a sign-in from the last 5 minutes. */
export async function startSession(idToken: string): Promise<string> {
  const decoded = await adminAuth().verifyIdToken(idToken);
  if (Date.now() / 1000 - decoded.auth_time > 5 * 60) throw new Error("sign-in too old");
  const expiresIn = SESSION_DAYS * 24 * 3600 * 1000;
  const cookie = await adminAuth().createSessionCookie(idToken, { expiresIn });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, cookie, { ...base(), maxAge: expiresIn / 1000 });
  jar.delete(PLAYER_COOKIE);
  return decoded.uid;
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const uid = await currentUid();
  if (uid) await adminAuth().revokeRefreshTokens(uid).catch(() => {});
  for (const n of [SESSION_COOKIE, PLAYER_COOKIE, PARENT_COOKIE, PENDING_COOKIE]) jar.delete(n);
}

/* ---------- which child is playing ---------- */

export async function setCurrentPlayer(uid: string, playerId: string): Promise<void> {
  (await cookies()).set(PLAYER_COOKIE, signToken("player", { uid, pid: playerId }, 30 * 24 * 3600), {
    ...base(),
    maxAge: 30 * 24 * 3600,
  });
}

export async function currentPlayerId(uid: string): Promise<string | null> {
  const t = verifyToken<{ uid: string; pid: string }>("player", (await cookies()).get(PLAYER_COOKIE)?.value);
  return t && t.uid === uid ? t.pid : null;
}

export async function clearCurrentPlayer(): Promise<void> {
  (await cookies()).delete(PLAYER_COOKIE);
}

/* ---------- parent area lock ---------- */

export async function unlockParentArea(uid: string): Promise<void> {
  const ttl = PARENT_UNLOCK_MINUTES * 60;
  (await cookies()).set(PARENT_COOKIE, signToken("parent", { uid }, ttl), { ...base(), maxAge: ttl });
}

export async function parentAreaUnlocked(uid: string): Promise<boolean> {
  const t = verifyToken<{ uid: string }>("parent", (await cookies()).get(PARENT_COOKIE)?.value);
  return !!t && t.uid === uid;
}

export async function lockParentArea(): Promise<void> {
  (await cookies()).delete(PARENT_COOKIE);
}

/* ---------- email waiting for its link ---------- */

/** devLink is set only in local development with the emulators (see mailer.devMailMode). */
export async function setPendingEmail(email: string, devLink?: string): Promise<void> {
  (await cookies()).set(PENDING_COOKIE, signToken("pending", devLink ? { email, devLink } : { email }, 3600), { ...base(), maxAge: 3600 });
}

export async function pendingSignIn(): Promise<{ email: string; devLink?: string } | null> {
  const t = verifyToken<{ email: string; devLink?: string }>("pending", (await cookies()).get(PENDING_COOKIE)?.value);
  return t ? { email: t.email, devLink: t.devLink } : null;
}

export async function pendingEmail(): Promise<string | null> {
  return (await pendingSignIn())?.email ?? null;
}
