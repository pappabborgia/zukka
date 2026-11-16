import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GameHost } from "@/components/GameHost";
import { PumpkinMark } from "@/components/PumpkinMark";
import { BUILTIN_CATALOG } from "@/generated/builtin-catalog";
import { t } from "@/i18n";
import { gameUrl } from "@/lib/origins";

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
  return (
    <div className="playpage">
      <header className="topbar">
        <Link href="/" className="back" aria-label={t("play.back")}>
          <PumpkinMark size={32} />
        </Link>
        <h1>{game.title}</h1>
        <span className="grow" />
        <Link href="/" className="back">
          ← {t("play.back")}
        </Link>
      </header>
      <GameHost src={gameUrl(game.id)} title={game.title} debug={debug === "1"} />
    </div>
  );
}
