import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { askForChange } from "@/app/actions/free";
import { chooseVersion, removeDraft } from "@/app/actions/studio";
import { AutoRefresh } from "@/components/AutoRefresh";
import { ChangeBox } from "@/components/ChangeBox";
import { GameHost } from "@/components/GameHost";
import { SiteHeader } from "@/components/SiteHeader";
import { BUILTIN_CATALOG } from "@/generated/builtin-catalog";
import { versionUrl } from "@/lib/origins";
import { aiConfigured } from "@/lib/server/ai-budget";
import { getMyGame, listVersions } from "@/lib/server/games";
import { requireParent } from "@/lib/server/guards";
import { STATUS_LABEL } from "@/lib/studio-ui";

/** a change asked here keeps running after the page has answered */
export const maxDuration = 300;

export const metadata: Metadata = { title: "Your game" };

export default async function StudioGamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const acc = await requireParent(`/studio/games/${id}`);
  const game = await getMyGame(acc.uid, id);
  if (!game) notFound();
  const versions = await listVersions(acc.uid, id);
  const current = versions.find((v) => v.id === game.currentVersionId) ?? null;
  const editable = game.status === "draft" || game.status === "changes_requested";
  const working = game.generation?.state === "running";
  const failed = game.generation?.state === "failed" ? game.generation : null;
  const parentTitle = game.parentGameId ? (BUILTIN_CATALOG.find((g) => g.id === game.parentGameId)?.title ?? "another game") : null;
  const blocking = (current?.problems ?? []).filter((p) => p.severity === "blocking");
  const others = (current?.problems ?? []).filter((p) => p.severity !== "blocking");

  const preview = game.currentVersionId ? (
    <div className="preview-frame">
      <GameHost src={versionUrl(id, game.currentVersionId)} title={game.title} debug />
    </div>
  ) : (
    <div className="preview-frame preview-empty">
      <p>{working ? "The game will appear here when it is ready." : "There is no version of this game yet."}</p>
    </div>
  );

  return (
    <>
      <SiteHeader title="Studio" />
      {working && <AutoRefresh />}
      <main className="page">
        <p>
          <Link href="/studio">← Your games</Link>
        </p>
        <div className="row-between">
          <div>
            <span className={`status status-${game.status}`}>{STATUS_LABEL[game.status]}</span>
            <h1 data-testid="studio-game-title">{game.title}</h1>
            <p className="hint">
              {game.kind === "free" ? "Made with AI" : "Made from a template"} · {game.subject}
              {game.year === "other" ? "" : ` · Year ${game.year}`}
              {parentTitle ? ` · your own version of ${parentTitle}` : ""}
            </p>
          </div>
          <div className="row-gap">
            {editable && game.kind === "quick" && (
              <Link href={`/studio/games/${id}/edit`} className="btn">
                ✏️ Change it
              </Link>
            )}
            <span className="btn btn-light" aria-disabled="true" title="Sending for review arrives in the next update">
              Send for review (soon)
            </span>
          </div>
        </div>

        {working && (
          <div className="ai-working" role="status" data-testid="ai-working">
            <span className="spinner" aria-hidden="true" />
            <div>
              <strong>{game.generation?.kind === "create" ? "The AI is building your game…" : "The AI is changing your game…"}</strong>
              <p className="hint">
                {game.generation?.request ? `“${game.generation.request}”. ` : ""}It usually takes one to three minutes. This page updates by itself.
              </p>
            </div>
          </div>
        )}
        {failed && (
          <p className="form-error" role="alert" data-testid="ai-failed">
            {failed.message ?? "The AI could not finish."} {game.currentVersionId ? "Your game is as it was before." : ""}
          </p>
        )}

        {game.kind === "free" ? (
          <div className="studio-split">
            <section>
              <h2>Try it</h2>
              {preview}
            </section>
            <aside>
              {blocking.length > 0 && (
                <div className="problems" data-testid="problems">
                  <strong>The safety check found problems in this version</strong>
                  <ul>
                    {blocking.map((p) => (
                      <li key={p.code}>The game {p.message}.</li>
                    ))}
                  </ul>
                  <p className="hint">It can be played here, but it cannot be sent for review until they are fixed. Ask: “Fix the problems found by the safety check”.</p>
                </div>
              )}
              {others.length > 0 && (
                <details className="problems minor">
                  <summary>Things to improve ({others.length})</summary>
                  <ul>
                    {others.map((p) => (
                      <li key={p.code}>The game {p.message}.</li>
                    ))}
                  </ul>
                </details>
              )}
              {editable && aiConfigured() && game.currentVersionId && <ChangeBox action={askForChange} gameId={id} disabled={working} />}
              {game.description && game.kind === "free" && (
                <details className="brief">
                  <summary>What you asked for</summary>
                  <p className="pre">{game.description}</p>
                </details>
              )}
            </aside>
          </div>
        ) : (
          <>
            <h2>Try it</h2>
            <p className="hint">This is the game exactly as children will see it. Below it, the messages the game sends to Zukka.</p>
            {preview}
          </>
        )}

        <h2>Versions</h2>
        <ol className="versions" data-testid="versions">
          {versions.map((v) => (
            <li key={v.id} className={v.id === game.currentVersionId ? "current" : ""}>
              <span>
                <b>Version {v.n}</b> · {v.note} · {v.createdAt.toLocaleString("en-GB")} · {Math.round(v.bytes / 1024)} KB
              </span>
              {v.id === game.currentVersionId ? (
                <em>in use</em>
              ) : editable && !working ? (
                <form action={chooseVersion}>
                  <input type="hidden" name="gameId" value={id} />
                  <input type="hidden" name="versionId" value={v.id} />
                  <button className="link-button" type="submit">
                    Go back to this version
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ol>

        {(editable || game.status === "rejected") && !working && (
          <details className="confirm">
            <summary className="btn btn-light">Delete this game</summary>
            <form action={removeDraft}>
              <input type="hidden" name="gameId" value={id} />
              <p>Delete {game.title} and all its versions? This cannot be undone.</p>
              <button type="submit" className="btn btn-danger">
                Yes, delete it
              </button>
            </form>
          </details>
        )}
      </main>
    </>
  );
}
