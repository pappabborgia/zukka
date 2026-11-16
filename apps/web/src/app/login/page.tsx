import type { Metadata } from "next";
import Link from "next/link";
import { requestSignIn } from "@/app/actions/auth";
import { ActionForm } from "@/components/ActionForm";
import { SiteHeader } from "@/components/SiteHeader";
import { safeNext } from "@/lib/server/guards";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next, "/who");
  return (
    <>
      <SiteHeader />
      <main className="page narrow">
        <h1>Sign in or create an account</h1>
        <p>
          Zukka accounts are for <strong>parents and carers</strong> (18 or over). Children play inside your account, with
          a profile you create for them.
        </p>
        <ActionForm action={requestSignIn} submitLabel="Email me a sign-in link" pendingLabel="Sending…" testId="login-form">
          <input type="hidden" name="next" value={next} />
          <label className="field">
            Your email address
            <input type="email" name="email" required autoComplete="email" maxLength={254} />
          </label>
          <p className="hint">No password: we email you a link. Your email is never shown to anyone.</p>
        </ActionForm>
        <p className="small">
          By creating an account you accept the <Link href="/privacy">privacy notice</Link>, the{" "}
          <Link href="/parental-consent">parental consent</Link> and the <Link href="/community-rules">community rules</Link>.
        </p>
      </main>
    </>
  );
}
