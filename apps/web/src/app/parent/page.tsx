import type { Metadata } from "next";
import Link from "next/link";
import { lockAndLeave, removePlayer } from "@/app/actions/account";
import { signOut } from "@/app/actions/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { avatarOf } from "@/lib/avatars";
import { MAX_PLAYERS_PER_ACCOUNT } from "@/lib/policies";
import { schoolYearLabel } from "@/lib/school-years";
import { listPlayers } from "@/lib/server/accounts";
import { requireParent } from "@/lib/server/guards";

export const metadata: Metadata = { title: "Parent area" };

export default async function ParentPage() {
  const acc = await requireParent("/parent");
  const players = await listPlayers(acc.uid);
  return (
    <>
      <SiteHeader title="Parent area" />
      <main className="page">
        <div className="row-between">
          <h1>Your children</h1>
          <div className="row-gap">
            <Link href="/studio" className="btn">
              🎨 Studio
            </Link>
            <Link href="/parent/settings" className="btn btn-light">
              ⚙️ Settings
            </Link>
            <form action={lockAndLeave}>
              <button className="btn btn-light" type="submit">
                🔒 Lock and go back
              </button>
            </form>
          </div>
        </div>
        <div className="parent-grid">
          {players.map((p) => {
            const a = avatarOf(p.avatar);
            return (
              <section key={p.id} className="card player-card" data-testid="parent-player">
                <div className="player-head">
                  <span className="who-avatar small" style={{ background: a.bg }}>
                    {a.emoji}
                  </span>
                  <div>
                    <h3>{p.nicknameText}</h3>
                    <p>
                      {schoolYearLabel(p.schoolYear)} · {p.showOnLeaderboards ? "on public leaderboards" : "private"}
                    </p>
                  </div>
                </div>
                <dl className="activity">
                  <div>
                    <dt>Games played</dt>
                    <dd>0</dd>
                  </div>
                  <div>
                    <dt>Points</dt>
                    <dd>0</dd>
                  </div>
                  <div>
                    <dt>Time played</dt>
                    <dd>0 min</dd>
                  </div>
                </dl>
                <p className="hint">Activity is recorded from phase 7, when plays are saved.</p>
                <div className="row-gap">
                  <Link href={`/parent/players/${p.id}`} className="btn btn-light">
                    Edit
                  </Link>
                  <details className="confirm">
                    <summary className="btn btn-light">Delete</summary>
                    <form action={removePlayer}>
                      <input type="hidden" name="playerId" value={p.id} />
                      <p>Delete {p.nicknameText} and all of this profile&apos;s activity? This cannot be undone.</p>
                      <button type="submit" className="btn btn-danger">
                        Yes, delete this profile
                      </button>
                    </form>
                  </details>
                </div>
              </section>
            );
          })}
          {players.length < MAX_PLAYERS_PER_ACCOUNT && (
            <Link href="/parent/players/new" className="card add-card">
              <span>＋</span>
              Add a player
              <small>
                {players.length} of {MAX_PLAYERS_PER_ACCOUNT}
              </small>
            </Link>
          )}
        </div>
        <form action={signOut} className="signout">
          <button type="submit" className="link-button">
            Sign out of Zukka on this device
          </button>
        </form>
      </main>
    </>
  );
}
