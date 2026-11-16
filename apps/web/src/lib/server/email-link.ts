import "server-only";
import { appOrigin, firebaseApiKey } from "./env";
import { adminAuth } from "./firebase";

/**
 * Passwordless sign-in with an email link.
 * - The link is generated on the server with the Admin SDK (generateSignInWithEmailLink), so Firebase
 *   sends no email and its daily email limits do not apply. Zukka sends the email itself (see mailer.ts).
 * - The email points straight to our /auth/finish page with the one-time code; it never goes through a
 *   Firebase-hosted page.
 * - Finishing the sign-in uses the Firebase Auth REST API from the server. The browser never loads Firebase.
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

/** Creates a one-time sign-in link for this address, pointing to our own /auth/finish page. */
export async function createSignInLink(email: string, next: string): Promise<string> {
  let generated: string;
  try {
    generated = await adminAuth().generateSignInWithEmailLink(email, { url: `${appOrigin()}/auth/finish`, handleCodeInApp: true });
  } catch (e) {
    const code = (e as { code?: string }).code ?? "";
    if (/invalid-email/.test(code)) throw new EmailLinkError("invalid_email");
    if (/too-many|quota/.test(code)) throw new EmailLinkError("too_many");
    throw new EmailLinkError("failed");
  }
  const oobCode = new URL(generated).searchParams.get("oobCode");
  if (!oobCode) throw new EmailLinkError("failed");
  const link = new URL("/auth/finish", appOrigin());
  link.searchParams.set("oobCode", oobCode);
  link.searchParams.set("next", next);
  return link.toString();
}

/** Exchanges the code from the link for a Firebase ID token (no email is sent by this call). */
export async function completeSignIn(email: string, oobCode: string): Promise<{ idToken: string; uid: string }> {
  const res = await fetch(`${identityBase()}/v1/accounts:signInWithEmailLink?key=${encodeURIComponent(firebaseApiKey())}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, oobCode }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg = String((json.error as { message?: string } | undefined)?.message ?? "");
    if (/EXPIRED_OOB_CODE|INVALID_OOB_CODE/.test(msg)) throw new EmailLinkError("expired_or_used");
    if (/INVALID_EMAIL/.test(msg)) throw new EmailLinkError("invalid_email");
    if (/TOO_MANY_ATTEMPTS|QUOTA_EXCEEDED/.test(msg)) throw new EmailLinkError("too_many");
    throw new EmailLinkError("failed");
  }
  if (typeof json.idToken !== "string" || typeof json.localId !== "string") throw new EmailLinkError("failed");
  return { idToken: json.idToken, uid: json.localId };
}
