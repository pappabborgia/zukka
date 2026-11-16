import type { Metadata } from "next";
import Link from "next/link";
import { finishSignIn } from "@/app/actions/auth";
import { ActionForm } from "@/components/ActionForm";
import { SiteHeader } from "@/components/SiteHeader";
import { safeNext } from "@/lib/server/guards";
import { pendingEmail } from "@/lib/server/session";

export const metadata: Metadata = { title: "Finish signing in" };

/**
 * The link from the email lands here. Signing in needs a tap on the button (a POST), so
 * email scanners that open links automatically cannot use up the link.
 */
export default async function FinishPage({ searchParams }: { searchParams: Promise<{ oobCode?: string; next?: string }> }) {
  const sp = await searchParams;
  const email = await pendingEmail();
  const oobCode = typeof sp.oobCode === "string" ? sp.oobCode : "";
  return (
    <>
      <SiteHeader />
      <main className="page narrow">
        <h1>Finish signing in</h1>
        {!oobCode ? (
          <p>
            This link is not complete. <Link href="/login">Ask for a new one</Link>.
          </p>
        ) : (
          <ActionForm action={finishSignIn} submitLabel="Sign me in" pendingLabel="Signing in…" testId="finish-form">
            <input type="hidden" name="oobCode" value={oobCode} />
            <input type="hidden" name="next" value={safeNext(sp.next, "/who")} />
            {email ? (
              <p>
                Signing in as <strong>{email}</strong>.
              </p>
            ) : (
              <label className="field">
                You opened the link on a different device. Please type your email address again:
                <input type="email" name="email" required autoComplete="email" />
              </label>
            )}
          </ActionForm>
        )}
      </main>
    </>
  );
}
