import type { Metadata } from "next";
import { LegalNote, LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Community rules" };

export default function CommunityRulesPage() {
  return (
    <LegalPage title="Community rules">
      <p>Zukka is for children aged 6 to 9. Every game is reviewed before it is published.</p>
      <h2>Games you create must not contain</h2>
      <ul>
        <li>characters, brands, clubs or teams that belong to someone else (no famous cartoon characters, no real football clubs);</li>
        <li>personal data of children or anyone else: no real names, photos, schools, addresses;</li>
        <li>violence, fear, unkind words or anything not suitable for young children;</li>
        <li>links, adverts, requests for data, or attempts to reach the internet.</li>
      </ul>
      <h2>Nicknames</h2>
      <p>Children&apos;s nicknames come only from our word lists. Creator nicknames must not be real names, emails, links or rude words.</p>
      <h2>Fair play</h2>
      <p>
        Points and credits are counted by Zukka. Playing in ways that only aim to collect points or credits (for example
        many very short plays) does not count, and points or credits gained that way can be cancelled.
      </p>
      <h2>Reports</h2>
      <p>Anyone can report a problem with a game. A person from our team looks at every report.</p>
      <LegalNote>Terms of use: ownership and licence of games created with AI; liability for published content; notice and action procedure (EU Digital Services Act); suspension of accounts.</LegalNote>
    </LegalPage>
  );
}
