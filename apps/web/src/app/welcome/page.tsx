import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { completeSignup } from "@/app/actions/account";
import { ActionForm } from "@/components/ActionForm";
import { SiteHeader } from "@/components/SiteHeader";
import { POLICY_VERSION } from "@/lib/policies";
import { getAccount } from "@/lib/server/accounts";
import { currentUid } from "@/lib/server/session";

export const metadata: Metadata = { title: "Welcome" };

export default async function WelcomePage() {
  const uid = await currentUid();
  if (!uid) redirect("/login");
  if (await getAccount(uid)) redirect("/who");
  return (
    <>
      <SiteHeader />
      <main className="page narrow">
        <h1>Welcome to Zukka</h1>
        <p>Before your children can play, we need three confirmations from you and a PIN for the parent area.</p>
        <ActionForm action={completeSignup} submitLabel="Create my account" pendingLabel="Creating…" testId="welcome-form">
          <label className="check">
            <input type="checkbox" name="adult" required />
            <span>I am 18 or over, and I am a parent or legal guardian of the children I will add.</span>
          </label>
          <label className="check">
            <input type="checkbox" name="childProfiles" required />
            <span>
              I give my consent to creating player profiles for my children, as described in the{" "}
              <Link href="/parental-consent" target="_blank">
                parental consent
              </Link>
              . Their profiles will hold only a nickname from our lists, an avatar, their school year and their game activity.
            </span>
          </label>
          <label className="check">
            <input type="checkbox" name="policies" required />
            <span>
              I have read the{" "}
              <Link href="/privacy" target="_blank">
                privacy notice
              </Link>{" "}
              and the{" "}
              <Link href="/community-rules" target="_blank">
                community rules
              </Link>{" "}
              (version {POLICY_VERSION}).
            </span>
          </label>
          <fieldset>
            <legend>Parent area PIN</legend>
            <p className="hint">4 to 6 digits. It keeps children out of the parent area. You can reset it with an email link.</p>
            <div className="pin-row">
              <label className="field">
                PIN
                <input type="password" name="pin" inputMode="numeric" pattern="\d{4,6}" minLength={4} maxLength={6} required autoComplete="new-password" />
              </label>
              <label className="field">
                PIN again
                <input type="password" name="pin2" inputMode="numeric" pattern="\d{4,6}" minLength={4} maxLength={6} required autoComplete="new-password" />
              </label>
            </div>
          </fieldset>
        </ActionForm>
      </main>
    </>
  );
}
