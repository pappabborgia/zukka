import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { choosePlayer } from "@/app/actions/account";
import { PumpkinMark } from "@/components/PumpkinMark";
import { avatarOf } from "@/lib/avatars";
import { listPlayers } from "@/lib/server/accounts";
import { requireAccount, safeNext } from "@/lib/server/guards";

export const metadata: Metadata = { title: "Who's playing?" };

export default async function WhoPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const acc = await requireAccount("/who");
  const players = await listPlayers(acc.uid);
  if (players.length === 0) redirect("/parent/players/new?first=1");
  const next = safeNext((await searchParams).next, "/");
  return (
    <main className="who">
      <Link href="/" className="who-logo" aria-label="Zukka home">
        <PumpkinMark size={56} />
      </Link>
      <h1>Who&apos;s playing?</h1>
      <div className="who-grid">
        {players.map((p) => {
          const a = avatarOf(p.avatar);
          return (
            <form key={p.id} action={choosePlayer}>
              <input type="hidden" name="playerId" value={p.id} />
              <input type="hidden" name="next" value={next} />
              <button type="submit" className="who-player" data-testid="who-player">
                <span className="who-avatar" style={{ background: a.bg }}>
                  {a.emoji}
                </span>
                <span className="who-name">{p.nicknameText}</span>
              </button>
            </form>
          );
        })}
      </div>
      <Link href="/parent" className="who-parent">
        🔒 Parent area
      </Link>
    </main>
  );
}
