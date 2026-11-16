import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { savePlayer } from "@/app/actions/account";
import { ActionForm } from "@/components/ActionForm";
import { PlayerFields } from "@/components/PlayerFields";
import { SiteHeader } from "@/components/SiteHeader";
import { randomNickname } from "@/lib/nicknames";
import { MAX_PLAYERS_PER_ACCOUNT } from "@/lib/policies";
import { listPlayers, nicknameAvailable } from "@/lib/server/accounts";
import { requireParent } from "@/lib/server/guards";

export const metadata: Metadata = { title: "Add a player" };

export default async function NewPlayerPage({ searchParams }: { searchParams: Promise<{ first?: string }> }) {
  const acc = await requireParent("/parent/players/new");
  if ((await listPlayers(acc.uid)).length >= MAX_PLAYERS_PER_ACCOUNT) redirect("/parent");
  let start = randomNickname();
  for (let i = 0; i < 5 && !(await nicknameAvailable(start)); i++) start = randomNickname();
  const first = (await searchParams).first === "1";
  return (
    <>
      <SiteHeader title="Parent area" />
      <main className="page narrow">
        <h1>{first ? "Add your first player" : "Add a player"}</h1>
        <p>A profile has no real name, no photo and no birthday: just a nickname, an avatar and a school year.</p>
        <ActionForm action={savePlayer} submitLabel="Save this player" pendingLabel="Saving…" testId="player-form">
          <PlayerFields startNickname={start} />
        </ActionForm>
      </main>
    </>
  );
}
