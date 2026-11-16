import type { Metadata } from "next";
import { LegalNote, LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy notice" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy notice">
      <h2>Who we are</h2>
      <p>Zukka is a website of learning games for children aged 6 to 9, made by parents.</p>
      <LegalNote>Name, address and contact details of the data controller; whether a data protection officer or a UK/EU representative is needed.</LegalNote>

      <h2>What we keep</h2>
      <ul>
        <li>
          <strong>About you (the parent):</strong> your email address, used only to sign you in and to write to you about
          your account and your games. It is never shown to anyone. The date and version of the consent you gave. A PIN
          for the parent area, stored only in a form that cannot be read back. If you create games: a creator nickname you
          choose.
        </li>
        <li>
          <strong>About each child:</strong> a nickname made from our word lists, an avatar from our gallery, the school
          year, whether the profile appears on public leaderboards, and their game activity (games played, answers right
          and wrong, points, time). Nothing else: no real name, no surname, no email, no birthday, no photo, no voice.
        </li>
      </ul>

      <h2>Why</h2>
      <p>To run your account and your children&apos;s profiles, show points and leaderboards, review the games before they are published, and keep the platform safe.</p>
      <LegalNote>Legal basis for each purpose (contract, consent, legitimate interest); age of digital consent (UK 13, Italy 14, Spain 14) and how parental consent is verified.</LegalNote>

      <h2>What we never do</h2>
      <ul>
        <li>No advertising and no tracking cookies.</li>
        <li>No chat, comments or messages between users. Children never write text that others can see.</li>
        <li>Games never receive any data about the player.</li>
      </ul>

      <h2>Cookies</h2>
      <p>
        Only the cookies needed for the site to work: your sign-in, which child is playing on this device, whether the
        parent area is open, and the email waiting for its sign-in link.
      </p>
      <LegalNote>Confirm these are strictly necessary cookies and need no consent banner.</LegalNote>

      <h2>Who else handles the data</h2>
      <p>
        Google Firebase (sign-in and database), Vercel (hosting), Anthropic (AI used to create and review games, from
        phase 3: it receives the texts parents write when creating a game, never the children&apos;s data).
      </p>
      <LegalNote>Data processing agreements, location of the data (Firestore region), transfers outside the UK/EU and safeguards.</LegalNote>

      <h2>How long</h2>
      <p>Until you delete a profile or the account. You can do both yourself, at any time, in the parent area.</p>
      <LegalNote>Retention periods for backups, logs, review records and the credit ledger after deletion.</LegalNote>

      <h2>Your rights</h2>
      <p>
        You can download all your data and delete it from the parent area. For anything else, write to us.
      </p>
      <LegalNote>Contact address; right to complain to the ICO (UK) or the Garante (Italy) or the AEPD (Spain).</LegalNote>
    </LegalPage>
  );
}
