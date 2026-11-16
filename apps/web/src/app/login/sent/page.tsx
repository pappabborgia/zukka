import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { devMailMode } from "@/lib/server/mailer";
import { pendingSignIn } from "@/lib/server/session";

export const metadata: Metadata = { title: "Check your email" };

export default async function SentPage() {
  const pending = await pendingSignIn();
  const email = pending?.email ?? null;
  // Local development only (emulators, no email service): the link is shown here instead of being emailed.
  let devLink: string | null = null;
  if (devMailMode() && pending?.devLink) {
    const u = new URL(pending.devLink);
    devLink = `${u.pathname}${u.search}`;
  }
  return (
    <>
      <SiteHeader />
      <main className="page narrow">
        <h1>Check your email</h1>
        <p>
          We sent a sign-in link{email ? <> to <strong>{email}</strong></> : null}. Open it on this device to continue. It works
          only once.
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
