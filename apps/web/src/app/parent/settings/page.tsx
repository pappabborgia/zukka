import type { Metadata } from "next";
import Link from "next/link";
import { changePin, deleteMyAccount, saveCreatorNickname } from "@/app/actions/account";
import { ActionForm } from "@/components/ActionForm";
import { SiteHeader } from "@/components/SiteHeader";
import { requireParent } from "@/lib/server/guards";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const acc = await requireParent("/parent/settings");
  return (
    <>
      <SiteHeader title="Parent area" />
      <main className="page narrow">
        <p>
          <Link href="/parent">← Your children</Link>
        </p>
        <h1>Settings</h1>

        <section className="card">
          <h2>Creator nickname</h2>
          <p>
            The public name shown on the games you create (from phase 3). Not your real name, please. Your email is never
            shown.
          </p>
          <ActionForm action={saveCreatorNickname} submitLabel="Save nickname" okMessage="Saved." testId="creator-form">
            <label className="field">
              Creator nickname
              <input name="creatorNickname" defaultValue={acc.creatorNickname ?? ""} minLength={3} maxLength={20} required />
            </label>
          </ActionForm>
        </section>

        <section className="card">
          <h2>Parent area PIN</h2>
          <ActionForm action={changePin} submitLabel="Change PIN" okMessage="PIN changed." testId="change-pin-form">
            <div className="pin-row">
              <label className="field">
                New PIN
                <input type="password" name="pin" inputMode="numeric" pattern="\d{4,6}" minLength={4} maxLength={6} required autoComplete="new-password" />
              </label>
              <label className="field">
                New PIN again
                <input type="password" name="pin2" inputMode="numeric" pattern="\d{4,6}" minLength={4} maxLength={6} required autoComplete="new-password" />
              </label>
            </div>
          </ActionForm>
        </section>

        <section className="card">
          <h2>Your data</h2>
          <p>Download everything Zukka keeps about your account and your children, as a JSON file.</p>
          <a href="/parent/export" className="btn btn-light" download>
            ⬇️ Download my data
          </a>
          <p className="small">
            Consent given on {acc.consent.acceptedAt.toLocaleDateString("en-GB")} (version {acc.consent.policyVersion}).
          </p>
        </section>

        <section className="card danger-zone">
          <h2>Delete the account</h2>
          <p>
            This deletes your account, all your children&apos;s profiles and all their activity, at once and for good.
          </p>
          <ActionForm action={deleteMyAccount} submitLabel="Delete everything" danger testId="delete-form">
            <label className="field">
              Type DELETE to confirm
              <input name="confirm" autoComplete="off" required />
            </label>
          </ActionForm>
        </section>
      </main>
    </>
  );
}
