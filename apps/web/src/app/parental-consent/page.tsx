import type { Metadata } from "next";
import { LegalNote, LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Parental consent" };

export default function ParentalConsentPage() {
  return (
    <LegalPage title="Parental consent">
      <p>Children cannot sign up to Zukka. Their profiles exist only inside a parent&apos;s account, with the parent&apos;s consent.</p>
      <h2>By giving consent you confirm that</h2>
      <ul>
        <li>you are 18 or over;</li>
        <li>you are a parent or legal guardian of each child you add;</li>
        <li>
          you agree that Zukka keeps, for each child, only: a nickname from our word lists, an avatar from our gallery, the
          school year, the choice about public leaderboards, and the child&apos;s game activity;
        </li>
        <li>you decide, for each child, whether the nickname and avatar appear on the public leaderboards (off unless you turn it on).</li>
      </ul>
      <h2>You can change your mind</h2>
      <p>
        In the parent area you can change the leaderboard choice, delete a child&apos;s profile with all its activity, or
        delete the whole account. Deleting is immediate.
      </p>
      <p>We record the date and the version of this text when you give your consent.</p>
      <LegalNote>Whether a self-declaration of age and parenthood is enough, or a stronger check is required (COPPA &quot;verifiable parental consent&quot; if US users are allowed; UK Children&apos;s Code; GDPR Art. 8).</LegalNote>
      <LegalNote>Whether a parent can consent for children of other families (e.g. a teacher), and whether schools are in scope.</LegalNote>
    </LegalPage>
  );
}
