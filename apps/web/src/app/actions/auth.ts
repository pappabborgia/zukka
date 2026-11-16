"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getAccount } from "@/lib/server/accounts";
import { completeSignIn, createSignInLink, EmailLinkError } from "@/lib/server/email-link";
import { devMailMode, sendEmail, signInEmail } from "@/lib/server/mailer";
import { clientIp, safeNext } from "@/lib/server/guards";
import { hit, LIMITS } from "@/lib/server/rate-limit";
import { endSession, pendingEmail, setPendingEmail, startSession, unlockParentArea } from "@/lib/server/session";

export type FormState = { error?: string; ok?: boolean } | undefined;

const Email = z.string().trim().toLowerCase().max(254).email();

/** Step 1: the parent types their email and gets a sign-in link. */
export async function requestSignIn(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = Email.safeParse(form.get("email"));
  if (!parsed.success) return { error: "Please type a valid email address." };
  const email = parsed.data;
  const ip = await clientIp();
  try {
    if (!(await hit("login-email", email, LIMITS.loginPerEmail.limit, LIMITS.loginPerEmail.windowSeconds)))
      return { error: "We have already sent several links to this address. Please wait an hour and try again." };
    if (!(await hit("login-ip", ip, LIMITS.loginPerIp.limit, LIMITS.loginPerIp.windowSeconds)))
      return { error: "Too many requests from this connection. Please try again later." };
  } catch (e) {
    console.error("sign-in unavailable", e);
    return { error: "Signing in is not available right now. Please try again later." };
  }
  const next = safeNext(form.get("next"), "/who");
  let devLink: string | undefined;
  try {
    const link = await createSignInLink(email, next);
    if (devMailMode()) devLink = link; // local development with the emulators: shown on screen, never in production
    else await sendEmail(signInEmail(email, link));
  } catch (e) {
    if (e instanceof EmailLinkError && e.code === "invalid_email") return { error: "Please type a valid email address." };
    console.error("sign-in email not sent", e);
    return { error: "We could not send the email just now. Please try again in a few minutes." };
  }
  await setPendingEmail(email, devLink);
  redirect("/login/sent");
}

/** Step 2: the parent comes back from the link and confirms. */
export async function finishSignIn(_prev: FormState, form: FormData): Promise<FormState> {
  const oobCode = String(form.get("oobCode") ?? "");
  if (!/^[\w-]{10,200}$/.test(oobCode)) return { error: "This link is not complete. Please ask for a new one." };
  const typed = Email.safeParse(form.get("email"));
  const email = (await pendingEmail()) ?? (typed.success ? typed.data : null);
  if (!email) return { error: "Please type the email address you used." };
  if (!(await hit("finish-ip", await clientIp(), LIMITS.finishPerIp.limit, LIMITS.finishPerIp.windowSeconds)))
    return { error: "Too many attempts from this connection. Please try again later." };
  let uid: string;
  try {
    const { idToken } = await completeSignIn(email, oobCode);
    uid = await startSession(idToken);
  } catch (e) {
    if (e instanceof EmailLinkError && e.code === "expired_or_used")
      return { error: "This link has expired or was already used. Please ask for a new one." };
    return { error: "We could not sign you in with this link. Check the email address, or ask for a new link." };
  }
  // a fresh email link also opens the parent area for a few minutes (it is how a forgotten PIN is reset)
  await unlockParentArea(uid);
  const account = await getAccount(uid);
  if (!account) redirect("/welcome");
  redirect(safeNext(form.get("next"), "/who"));
}

export async function signOut(): Promise<void> {
  await endSession();
  redirect("/");
}
