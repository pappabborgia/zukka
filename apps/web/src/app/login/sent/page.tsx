import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { emulatorOobCodes } from "@/lib/server/email-link";
import { usingEmulators } from "@/lib/server/env";
import { pendingEmail } from "@/lib/server/session";

export const metadata: Metadata = { title: "Check your email" };

export default async function SentPage() {
  const email = await pendingEmail();
  // Local development only: the emulator does not send emails, so show the link here.
  let devLink: string | null = null;
  if (usingEmulators() && email) {
    const codes = (await emulatorOobCodes()).filter((c) => c.email === email && c.requestType === "EMAIL_SIGNIN");
    const last = codes.at(-1);
    if (last) devLink = `/auth/finish?mode=signIn&oobCode=${encodeURIComponent(last.oobCode)}`;
  }
  return (
    <>
      <SiteHeader />
      <main className="page narrow">
        <h1>Check your email</h1>
        <p>
          We sent a sign-in link{email ? <> to <strong>{email}</strong></> : null}. Open it on this device to continue. It works
          once and expires after a while.
        </p>
        <p className="hint">Nothing arrived? Look in the spam folder, or <Link href="/login">ask for a new link</Link>.</p>
        {devLink && (
          <p className="dev-note">
            Local development (no emails are sent): <a href={devLink} data-testid="dev-signin-link">open the sign-in link</a>
          </p>
        )}
      </main>
    </>
  );
}
