import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createFree, createFreeRemix } from "@/app/actions/free";
import { ActionForm } from "@/components/ActionForm";
import { FreeGameWizard } from "@/components/FreeGameWizard";
import { SiteHeader } from "@/components/SiteHeader";
import { BUILTIN_CATALOG } from "@/generated/builtin-catalog";
import { aiConfigured } from "@/lib/server/ai-budget";
import { builtinStartHtml } from "@/lib/server/free-games";
import { requireParent } from "@/lib/server/guards";
import { TOPIC_CHOICES } from "@/lib/studio-ui";

/** the AI keeps writing the game after the page has answered */
export const maxDuration = 300;

export const metadata: Metadata = { title: "Describe a new game" };

export default async function NewFreeGamePage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  await requireParent("/studio/new/free");
  const { from } = await searchParams;

  if (from) {
    const source = BUILTIN_CATALOG.find((g) => g.id === from && g.listed);
    if (!source || !builtinStartHtml(source.id)) notFound();
    return (
      <>
        <SiteHeader title="Studio" />
        <main className="page narrow">
          <p>
            <Link href="/studio/new">← Back</Link>
          </p>
          <h1>Your own version of {source.title}</h1>
          <p>
            You start from a copy of the game. Then you tell the AI what to change: places, characters, colours, questions,
            levels. The original game never changes.
          </p>
          <ActionForm action={createFreeRemix} submitLabel="Make my copy" pendingLabel="Copying…" testId="remix-form">
            <input type="hidden" name="from" value={source.id} />
            <label className="field">
              Name of your version
              <input name="title" defaultValue={`My ${source.title}`.slice(0, 40)} minLength={3} maxLength={40} required />
            </label>
          </ActionForm>
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader title="Studio" />
      <main className="page narrow">
        <p>
          <Link href="/studio/new">← Back</Link>
        </p>
        <h1>Describe a new game</h1>
        <p>Five short steps. The more you tell us, the better the game the AI can build.</p>
        {aiConfigured() ? (
          <FreeGameWizard action={createFree} topics={TOPIC_CHOICES} />
        ) : (
          <p className="form-error">The AI is not available here, so new games cannot be described yet.</p>
        )}
      </main>
    </>
  );
}
