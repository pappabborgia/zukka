import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { STUDIO_LIMITS } from "@/lib/config/studio";
import { listMyGames } from "@/lib/server/games";
import { requireParent } from "@/lib/server/guards";
import { STATUS_LABEL } from "@/lib/studio-ui";

export const metadata: Metadata = { title: "Studio" };

export default async function StudioPage() {
  const acc = await requireParent("/studio");
  const games = await listMyGames(acc.uid);
  const drafts = games.filter((g) => g.status === "draft").length;
  return (
    <>
      <SiteHeader title="Studio" />
      <main className="page">
        <p>
          <Link href="/parent">← Parent area</Link>
        </p>
        <div className="row-between">
          <h1>🎨 Your games</h1>
          {drafts < STUDIO_LIMITS.maxDrafts ? (
            <Link href="/studio/new" className="btn">
              ＋ New game
            </Link>
          ) : (
            <span className="hint">You have {drafts} drafts: finish or delete one to start another.</span>
          )}
        </div>
        {games.length === 0 ? (
          <p className="empty">You have not made any games yet. Start from a template, or make your own version of a game.</p>
        ) : (
          <div className="grid">
            {games.map((g) => (
              <Link key={g.id} href={`/studio/games/${g.id}`} className="card" data-testid="studio-game">
                <span className={`status status-${g.status}`}>{STATUS_LABEL[g.status]}</span>
                <h3>{g.title}</h3>
                <p>
                  {g.subject} · Year {g.year} · {g.versionCount} version{g.versionCount === 1 ? "" : "s"}
                </p>
                <small className="hint">Changed {g.updatedAt.toLocaleDateString("en-GB")}</small>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
