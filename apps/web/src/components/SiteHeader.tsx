import Link from "next/link";
import { avatarOf } from "@/lib/avatars";
import { getAccount } from "@/lib/server/accounts";
import { currentPlayer } from "@/lib/server/guards";
import { currentUid } from "@/lib/server/session";
import { Logo } from "./PumpkinMark";

/** Top bar: the logo, and who is playing (or a sign-in link). Never shows the parent's email. */
export async function SiteHeader({ title }: { title?: string }) {
  const uid = await currentUid();
  const account = uid ? await getAccount(uid) : null;
  const player = account ? await currentPlayer(account.uid) : null;
  return (
    <header className="topbar">
      <Link href="/" className="back" aria-label="Zukka home">
        <Logo size={30} />
      </Link>
      {title && <h1>{title}</h1>}
      <span className="grow" />
      {!uid && (
        <Link href="/login" className="btn btn-small">
          Sign in
        </Link>
      )}
      {uid && !account && (
        <Link href="/welcome" className="btn btn-small">
          Finish setting up
        </Link>
      )}
      {account && player && (
        <Link href="/who" className="player-chip" data-testid="player-chip" title="Change player">
          <span className="avatar-dot" style={{ background: avatarOf(player.avatar).bg }}>
            {avatarOf(player.avatar).emoji}
          </span>
          {player.nicknameText}
        </Link>
      )}
      {account && !player && (
        <Link href="/who" className="btn btn-small">
          Who&apos;s playing?
        </Link>
      )}
    </header>
  );
}
