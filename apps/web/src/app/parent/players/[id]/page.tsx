import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { savePlayer } from "@/app/actions/account";
import { ActionForm } from "@/components/ActionForm";
import { PlayerFields } from "@/components/PlayerFields";
import { SiteHeader } from "@/components/SiteHeader";
import { getPlayer } from "@/lib/server/accounts";
import { requireParent } from "@/lib/server/guards";

export const metadata: Metadata = { title: "Edit player" };

export default async function EditPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const acc = await requireParent(`/parent/players/${id}`);
  const p = await getPlayer(acc.uid, id);
  if (!p) notFound();
  return (
    <>
      <SiteHeader title="Parent area" />
      <main className="page narrow">
        <h1>Edit {p.nicknameText}</h1>
        <ActionForm action={savePlayer} submitLabel="Save changes" pendingLabel="Saving…" testId="player-form">
          <input type="hidden" name="playerId" value={p.id} />
          <PlayerFields
            startNickname={p.nickname}
            initial={{ avatar: p.avatar, schoolYear: p.schoolYear, showOnLeaderboards: p.showOnLeaderboards }}
          />
        </ActionForm>
      </main>
    </>
  );
}
