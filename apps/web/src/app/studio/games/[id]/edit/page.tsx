import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { saveQuickVersion } from "@/app/actions/studio";
import { QuickGameForm, type QuickValues } from "@/components/QuickGameForm";
import { SiteHeader } from "@/components/SiteHeader";
import { getMyGame } from "@/lib/server/games";
import { aiQuestionsConfigured } from "@/lib/server/ai-budget";
import { requireParent } from "@/lib/server/guards";
import { PATTERNS, TEAM_COLOURS, TIMES_TABLES, TOPIC_CHOICES } from "@/lib/studio-ui";

/** saving can wait for the AI questions */
export const maxDuration = 120;

export const metadata: Metadata = { title: "Change your game" };

export default async function EditQuickGamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const acc = await requireParent(`/studio/games/${id}/edit`);
  const game = await getMyGame(acc.uid, id);
  if (!game || game.kind !== "quick" || !game.quickForm) notFound();
  if (game.status !== "draft" && game.status !== "changes_requested") redirect(`/studio/games/${id}`);
  return (
    <>
      <SiteHeader title="Studio" />
      <main className="page narrow">
        <p>
          <Link href={`/studio/games/${id}`}>← Back to the game</Link>
        </p>
        <h1>Change {game.title}</h1>
        <p className="hint">Saving makes a new version. The earlier versions stay, and you can go back to them.</p>
        <QuickGameForm
          action={saveQuickVersion}
          submitLabel="Save a new version"
          topics={TOPIC_CHOICES}
          colours={TEAM_COLOURS}
          patterns={PATTERNS}
          tables={TIMES_TABLES}
          initial={game.quickForm as QuickValues}
          aiAvailable={aiQuestionsConfigured()}
          hidden={{ gameId: id }}
        />
      </main>
    </>
  );
}
