import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ENGINES } from "@zukka/engines";
import { createQuick } from "@/app/actions/studio";
import { QuickGameForm } from "@/components/QuickGameForm";
import { SiteHeader } from "@/components/SiteHeader";
import { parentGameInfo } from "@/lib/server/games";
import { aiQuestionsConfigured } from "@/lib/server/ai-budget";
import { requireParent } from "@/lib/server/guards";
import { NEW_QUICK_DEFAULTS, PATTERNS, TEAM_COLOURS, TIMES_TABLES, TOPIC_CHOICES } from "@/lib/studio-ui";

/** saving can wait for the AI questions */
export const maxDuration = 120;

export const metadata: Metadata = { title: "New game" };

export default async function NewQuickGamePage({ params, searchParams }: { params: Promise<{ engine: string }>; searchParams: Promise<{ from?: string }> }) {
  const { engine } = await params;
  const { from } = await searchParams;
  await requireParent(`/studio/new/${engine}`);
  if (!ENGINES[engine]?.quick) notFound();
  const parent = from ? await parentGameInfo(from) : null;
  return (
    <>
      <SiteHeader title="Studio" />
      <main className="page narrow">
        <p>
          <Link href="/studio/new">← Back</Link>
        </p>
        <h1>{parent ? `Your own version of ${parent.title}` : `New ${ENGINES[engine].name} game`}</h1>
        <p>{ENGINES[engine].description}</p>
        <QuickGameForm
          action={createQuick}
          submitLabel="Create the game"
          topics={TOPIC_CHOICES}
          colours={TEAM_COLOURS}
          patterns={PATTERNS}
          tables={TIMES_TABLES}
          initial={NEW_QUICK_DEFAULTS}
          aiAvailable={aiQuestionsConfigured()}
          hidden={{ engine, parentGameId: parent?.engine === engine ? parent.id : "" }}
        />
      </main>
    </>
  );
}
