import { timingSafeEqual } from "node:crypto";
import { deleteExpiredRateLimits } from "@/lib/server/rate-limit";

/**
 * Nightly maintenance, called by Vercel Cron (see vercel.json) with "Authorization: Bearer <CRON_SECRET>".
 * Today: delete expired rate-limit counters. Later phases add the Bayesian scores, the ledger
 * reconciliation and the anti-abuse report here.
 */
export const maxDuration = 60;

function authorised(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(req: Request) {
  if (!authorised(req)) return new Response("Unauthorized", { status: 401 });
  const started = Date.now();
  const rateLimitsDeleted = await deleteExpiredRateLimits();
  return Response.json({ ok: true, rateLimitsDeleted, ms: Date.now() - started });
}
