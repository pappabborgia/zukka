import { assertGameSize, injectConfig } from "@zukka/engines";
import { gameResponseHeaders } from "@zukka/game-protocol";
import { ENGINE_TEMPLATES } from "@/generated/engine-templates";
import { db } from "@/lib/firestore";
import { allowedParentOrigins } from "@/lib/origins";

/**
 * Serves one version of a created game, and stops serving it within a few minutes when the game is
 * removed, rejected or deleted:
 * - the content of a version never changes, so it is kept in memory (per server instance);
 * - the game's status is read again from Firestore at most every STATUS_TTL seconds (default 120);
 * - the browser and Vercel's CDN keep the response for CDN_SECONDS (default 60), never serving stale copies.
 * Worst case after a removal: STATUS_TTL + 2 x CDN_SECONDS (about 4 minutes).
 */
const ID = /^[A-Za-z0-9]{10,40}$/;
const STATUS_TTL_MS = 1000 * Number(process.env.GAME_STATUS_TTL_SECONDS ?? 120);
const CDN_SECONDS = Number(process.env.GAME_CDN_SECONDS ?? 60);

/** Statuses whose versions are served (drafts and games in review are needed for previews). */
const SERVED = new Set(["draft", "submitted", "ai_reviewed", "changes_requested", "approved"]);

const contentCache = new Map<string, string>();
const statusCache = new Map<string, { served: boolean; at: number }>();

function notFound(): Response {
  return new Response("Not found", {
    status: 404,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
      "Cache-Control": `public, max-age=${CDN_SECONDS}, s-maxage=${CDN_SECONDS}`,
    },
  });
}

/** Is the game still allowed to be played? One small Firestore read per game every STATUS_TTL at most. */
async function isServed(gameId: string, now = Date.now()): Promise<boolean> {
  const hit = statusCache.get(gameId);
  if (hit && now - hit.at < STATUS_TTL_MS) return hit.served;
  const snap = await db().collection("games").doc(gameId).get();
  const served = snap.exists && SERVED.has(snap.get("status"));
  if (statusCache.size > 2000) statusCache.delete(statusCache.keys().next().value!);
  statusCache.set(gameId, { served, at: now });
  return served;
}

async function content(gameId: string, versionId: string): Promise<string | null> {
  const key = `${gameId}/${versionId}`;
  const hit = contentCache.get(key);
  if (hit) return hit;
  const snap = await db().collection("games").doc(gameId).collection("versions").doc(versionId).get();
  if (!snap.exists) return null;
  const v = snap.data()!;
  let html: string;
  if (v.kind === "config") {
    const template = Object.hasOwn(ENGINE_TEMPLATES, v.engine) ? ENGINE_TEMPLATES[v.engine] : null;
    if (!template || typeof v.configJson !== "string") return null;
    html = injectConfig(template, JSON.parse(v.configJson));
  } else if (v.kind === "html" && typeof v.html === "string") {
    html = v.html;
  } else return null;
  assertGameSize(html);
  if (contentCache.size > 200) contentCache.delete(contentCache.keys().next().value!);
  contentCache.set(key, html);
  return html;
}

export async function GET(_req: Request, ctx: { params: Promise<{ gameId: string; versionId: string }> }) {
  const { gameId, versionId } = await ctx.params;
  if (!ID.test(gameId) || !ID.test(versionId)) return notFound();
  if (!(await isServed(gameId))) return notFound();
  const html = await content(gameId, versionId);
  if (!html) return notFound();
  const headers = gameResponseHeaders({ frameAncestors: allowedParentOrigins(), cacheSeconds: CDN_SECONDS });
  headers["Cache-Control"] = `public, max-age=${CDN_SECONDS}, s-maxage=${CDN_SECONDS}`;
  return new Response(html, { status: 200, headers });
}
