import type { Metadata } from "next";
import Link from "next/link";
import { unlockWithPin } from "@/app/actions/account";
import { ActionForm } from "@/components/ActionForm";
import { SiteHeader } from "@/components/SiteHeader";
import { requireAccount, safeNext } from "@/lib/server/guards";

export const metadata: Metadata = { title: "Parent area" };

export default async function UnlockPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  await requireAccount("/parent");
  const next = safeNext((await searchParams).next, "/parent");
  return (
    <>
      <SiteHeader />
      <main className="page narrow">
        <h1>🔒 Parent area</h1>
        <p>Grown-ups only: type your PIN.</p>
        <ActionForm action={unlockWithPin} submitLabel="Open" pendingLabel="Checking…" testId="pin-form">
          <input type="hidden" name="next" value={next} />
          <label className="field">
            PIN
            <input type="password" name="pin" inputMode="numeric" pattern="\d{4,6}" minLength={4} maxLength={6} required autoComplete="current-password" autoFocus />
          </label>
        </ActionForm>
        <p className="small">
          Forgot the PIN? <Link href={`/login?next=${encodeURIComponent("/parent/settings")}`}>Sign in again with an email link</Link>, then
          choose a new PIN in the settings.
        </p>
      </main>
    </>
  );
}
