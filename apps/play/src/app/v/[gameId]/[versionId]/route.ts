import { assertGameSize, injectConfig } from "@zukka/engines";
import { gameResponseHeaders } from "@zukka/game-protocol";
import { ENGINE_TEMPLATES } from "@/generated/engine-templates";
import { db } from "@/lib/firestore";
import { allowedParentOrigins } from "@/lib/origins";

/**
 * Serves one version of a created game. Versions never change, so the response is cached for a
 * year by the browser and by Vercel's CDN: Firestore is read once per version, not once per play.
 * A small in-memory cache also covers repeated requests to the same server instance.
 */
const ID = /^[A-Za-z0-9]{10,40}$/;
const YEAR = 365 * 24 * 3600;
const memory = new Map<string, string>();

function notFound(): Response {
  return new Response("Not found", {
    status: 404,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
      "Cache-Control": "public, max-age=60",
    },
  });
}

async function load(gameId: string, versionId: string): Promise<string | null> {
  const key = `${gameId}/${versionId}`;
  const hit = memory.get(key);
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
  if (memory.size > 200) memory.delete(memory.keys().next().value!);
  memory.set(key, html);
  return html;
}

export async function GET(_req: Request, ctx: { params: Promise<{ gameId: string; versionId: string }> }) {
  const { gameId, versionId } = await ctx.params;
  if (!ID.test(gameId) || !ID.test(versionId)) return notFound();
  const html = await load(gameId, versionId);
  if (!html) return notFound();
  const headers = gameResponseHeaders({ frameAncestors: allowedParentOrigins(), cacheSeconds: YEAR });
  headers["Cache-Control"] = `public, max-age=${YEAR}, s-maxage=${YEAR}, immutable`;
  return new Response(html, { status: 200, headers });
}
