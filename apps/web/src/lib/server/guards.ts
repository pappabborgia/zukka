import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAccount, getPlayer, type Account, type Player } from "./accounts";
import { currentPlayerId, currentUid, parentAreaUnlocked } from "./session";

/** Only same-site relative paths are accepted as "next" destinations. */
export function safeNext(next: unknown, fallback = "/"): string {
  return typeof next === "string" && /^\/(?!\/)[\w\-/?=&%.]*$/.test(next) ? next : fallback;
}

/** Signed-in parent with a completed account (consent given), or a redirect. */
export async function requireAccount(next = "/"): Promise<Account> {
  const uid = await currentUid();
  if (!uid) redirect(`/login?next=${encodeURIComponent(next)}`);
  const acc = await getAccount(uid);
  if (!acc) redirect("/welcome");
  return acc;
}

/** The parent area: account plus a recent PIN (or a fresh email link). */
export async function requireParent(next = "/parent"): Promise<Account> {
  const acc = await requireAccount(next);
  if (!(await parentAreaUnlocked(acc.uid))) redirect(`/parent/unlock?next=${encodeURIComponent(next)}`);
  return acc;
}

/** The child playing on this device, if one was chosen. */
export async function currentPlayer(uid: string): Promise<Player | null> {
  const pid = await currentPlayerId(uid);
  return pid ? getPlayer(uid, pid) : null;
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}
