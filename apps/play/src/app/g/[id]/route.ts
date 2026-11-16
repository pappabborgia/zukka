import { gameResponseHeaders } from "@zukka/game-protocol";
import { BUILTIN_GAMES } from "@/generated/builtin-games";
import { allowedParentOrigins } from "@/lib/origins";

/**
 * Serves one game document. In phase 1 the games are the built-in ones bundled at
 * build time; later phases will also serve approved and preview versions from storage.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const game = Object.hasOwn(BUILTIN_GAMES, id) ? BUILTIN_GAMES[id] : undefined;
  if (!game) {
    return new Response("Not found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'" },
    });
  }
  return new Response(game.html, { status: 200, headers: gameResponseHeaders({ frameAncestors: allowedParentOrigins() }) });
}
