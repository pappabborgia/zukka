import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { GameHost } from "@/components/GameHost";
import { PumpkinMark } from "@/components/PumpkinMark";
import { BUILTIN_CATALOG } from "@/generated/builtin-catalog";
import { t } from "@/i18n";
import { gameUrl } from "@/lib/origins";
import { avatarOf } from "@/lib/avatars";
import { getAccount } from "@/lib/server/accounts";
import { currentPlayer } from "@/lib/server/guards";
import { currentUid } from "@/lib/server/session";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ debug?: string }> };

const findGame = (slug: string) => BUILTIN_CATALOG.find((g) => g.id === slug && g.listed);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const game = findGame((await params).slug);
  return { title: game?.title ?? t("play.notFound") };
}

export default async function PlayPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { debug } = await searchParams;
  const game = findGame(slug);
  if (!game) notFound();

  // the catalogue is public; playing needs a parent account and a chosen player
  const uid = await currentUid();
  const account = uid ? await getAccount(uid) : null;
  if (uid && !account) redirect("/welcome");
  const player = account ? await currentPlayer(account.uid) : null;
  if (account && !player) redirect(`/who?next=${encodeURIComponent(`/play/${slug}`)}`);

  return (
    <div className="playpage">
      <header className="topbar">
        <Link href="/" className="back" aria-label={t("play.back")}>
          <PumpkinMark size={32} />
        </Link>
        <h1>{game.title}</h1>
        <span className="grow" />
        {player && (
          <Link href="/who" className="player-chip" data-testid="player-chip" title="Change player">
            <span className="avatar-dot" style={{ background: avatarOf(player.avatar).bg }}>
              {avatarOf(player.avatar).emoji}
            </span>
            {player.nicknameText}
          </Link>
        )}
        <Link href="/" className="back">
          ← {t("play.back")}
        </Link>
      </header>
      {player ? (
        <GameHost src={gameUrl(game.id)} title={game.title} debug={debug === "1"} />
      ) : (
        <main className="page narrow signin-to-play" data-testid="signin-to-play">
          <h2>{game.title}</h2>
          <p>{game.description}</p>
          <p>To play, a parent signs in and chooses who is playing. It is free.</p>
          <Link className="btn" href={`/login?next=${encodeURIComponent(`/play/${slug}`)}`}>
            Sign in to play
          </Link>
        </main>
      )}
    </div>
  );
}
