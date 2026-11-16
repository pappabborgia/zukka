import "server-only";
import { firebaseApiKey, firebaseProjectId } from "./env";

/**
 * Passwordless sign-in with an email link, done from the server through the Firebase Auth
 * REST API: the browser never loads Firebase code. Later the email can be sent through
 * Resend instead (Admin SDK generateSignInWithEmailLink + our own email), without changing the flow.
 */
function identityBase(): string {
  const emu = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  return emu ? `http://${emu}/identitytoolkit.googleapis.com` : "https://identitytoolkit.googleapis.com";
}

export class EmailLinkError extends Error {
  constructor(public code: "invalid_email" | "expired_or_used" | "too_many" | "failed") {
    super(code);
  }
}

async function call(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${identityBase()}/v1/${path}?key=${encodeURIComponent(firebaseApiKey())}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg = String((json.error as { message?: string } | undefined)?.message ?? "");
    if (/INVALID_EMAIL|MISSING_EMAIL/.test(msg)) throw new EmailLinkError("invalid_email");
    if (/EXPIRED_OOB_CODE|INVALID_OOB_CODE/.test(msg)) throw new EmailLinkError("expired_or_used");
    if (/TOO_MANY_ATTEMPTS|QUOTA_EXCEEDED/.test(msg)) throw new EmailLinkError("too_many");
    throw new EmailLinkError("failed");
  }
  return json;
}

/** Sends the sign-in email. continueUrl is where the link brings the parent back. */
export async function sendSignInEmail(email: string, continueUrl: string): Promise<void> {
  await call("accounts:sendOobCode", { requestType: "EMAIL_SIGNIN", email, continueUrl, canHandleCodeInApp: true });
}

/** Exchanges the code from the link for a Firebase ID token. */
export async function completeSignIn(email: string, oobCode: string): Promise<{ idToken: string; uid: string }> {
  const r = await call("accounts:signInWithEmailLink", { email, oobCode });
  if (typeof r.idToken !== "string" || typeof r.localId !== "string") throw new EmailLinkError("failed");
  return { idToken: r.idToken, uid: r.localId };
}

/** Emulator only: the sign-in codes the emulator would have emailed (for local development and tests). */
export async function emulatorOobCodes(): Promise<{ email: string; oobCode: string; requestType: string }[]> {
  const emu = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  if (!emu) return [];
  const res = await fetch(`http://${emu}/emulator/v1/projects/${firebaseProjectId()}/oobCodes`, { cache: "no-store" });
  const json = (await res.json()) as { oobCodes?: { email: string; oobCode: string; requestType: string }[] };
  return json.oobCodes ?? [];
}
