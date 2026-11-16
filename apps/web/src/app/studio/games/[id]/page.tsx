import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { removeDraft, chooseVersion } from "@/app/actions/studio";
import { GameHost } from "@/components/GameHost";
import { SiteHeader } from "@/components/SiteHeader";
import { BUILTIN_CATALOG } from "@/generated/builtin-catalog";
import { versionUrl } from "@/lib/origins";
import { getMyGame, listVersions } from "@/lib/server/games";
import { requireParent } from "@/lib/server/guards";
import { STATUS_LABEL } from "@/lib/studio-ui";

export const metadata: Metadata = { title: "Your game" };

export default async function StudioGamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const acc = await requireParent(`/studio/games/${id}`);
  const game = await getMyGame(acc.uid, id);
  if (!game) notFound();
  const versions = await listVersions(acc.uid, id);
  const editable = game.status === "draft" || game.status === "changes_requested";
  const parentTitle = game.parentGameId ? (BUILTIN_CATALOG.find((g) => g.id === game.parentGameId)?.title ?? "another game") : null;
  return (
    <>
      <SiteHeader title="Studio" />
      <main className="page">
        <p>
          <Link href="/studio">← Your games</Link>
        </p>
        <div className="row-between">
          <div>
            <span className={`status status-${game.status}`}>{STATUS_LABEL[game.status]}</span>
            <h1 data-testid="studio-game-title">{game.title}</h1>
            <p className="hint">
              {game.subject} · Year {game.year}
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

        <h2>Try it</h2>
        <p className="hint">This is the game exactly as children will see it. Below it, the messages the game sends to Zukka.</p>
        <div className="preview-frame">
          <GameHost src={versionUrl(id, game.currentVersionId)} title={game.title} debug />
        </div>

        <h2>Versions</h2>
        <ol className="versions" data-testid="versions">
          {versions.map((v) => (
            <li key={v.id} className={v.id === game.currentVersionId ? "current" : ""}>
              <span>
                <b>Version {v.n}</b> · {v.note} · {v.createdAt.toLocaleString("en-GB")} · {Math.round(v.bytes / 1024)} KB
              </span>
              {v.id === game.currentVersionId ? (
                <em>in use</em>
              ) : editable ? (
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

        {(editable || game.status === "rejected") && (
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
