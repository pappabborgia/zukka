import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { STUDIO_LIMITS } from "../config/studio";
import { usingEmulators } from "./env";
import { db } from "./firebase";
import { mailerConfigured, sendEmail } from "./mailer";

/**
 * Limits and spend for AI generations.
 * aiDaily/{uid}_{YYYY-MM-DD}   generations per account per day
 * aiMonthly/{YYYY-MM}          estimated spend for the whole platform, and whether the admins were warned
 * games/{id}.aiGenerations     generations per game
 */
export class AiLimitError extends Error {
  constructor(public code: "per_game" | "per_day" | "budget" | "not_configured") {
    super(code);
  }
}

/** Prices of the model used (US dollars per million tokens). */
const PRICE = { input: 4, output: 20 };

const day = (d = new Date()) => d.toISOString().slice(0, 10);
const month = (d = new Date()) => d.toISOString().slice(0, 7);

/** The API key as set on the host, without spaces, line breaks or quotes pasted around it by mistake. */
export function anthropicApiKey(): string | undefined {
  const k = process.env.ANTHROPIC_API_KEY?.trim().replace(/^["']+|["']+$/g, "").trim();
  return k || undefined;
}

/** The AI can be used: a key is set, or (local tests only) the stand-in AI is on. */
export const aiConfigured = () => !!anthropicApiKey() || (process.env.ZUKKA_FAKE_AI === "1" && usingEmulators());
/** Extra AI questions for quick games need the real AI (no stand-in). */
export const aiQuestionsConfigured = () => !!anthropicApiKey();

/** Takes one generation from the account's daily allowance (and the game's), if the monthly budget allows. */
export async function reserveGeneration(uid: string, gameId: string | null, now = new Date()): Promise<void> {
  if (!aiConfigured()) throw new AiLimitError("not_configured");
  const store = db();
  const dailyRef = store.collection("aiDaily").doc(`${uid}_${day(now)}`);
  const monthRef = store.collection("aiMonthly").doc(month(now));
  const gameRef = gameId ? store.collection("games").doc(gameId) : null;
  await store.runTransaction(async (tx) => {
    const [daily, m, game] = await Promise.all([tx.get(dailyRef), tx.get(monthRef), gameRef ? tx.get(gameRef) : Promise.resolve(null)]);
    if (((m.get("usd") as number) ?? 0) >= STUDIO_LIMITS.monthlyAiBudgetUsd) throw new AiLimitError("budget");
    if (((daily.get("count") as number) ?? 0) >= STUDIO_LIMITS.aiGenerationsPerAccountPerDay) throw new AiLimitError("per_day");
    if (game && ((game.get("aiGenerations") as number) ?? 0) >= STUDIO_LIMITS.aiGenerationsPerGame) throw new AiLimitError("per_game");
    tx.set(dailyRef, { uid, day: day(now), count: FieldValue.increment(1) }, { merge: true });
    if (gameRef && game?.exists) tx.update(gameRef, { aiGenerations: FieldValue.increment(1) });
  });
}

/** Adds the cost of a call to the month; the first time the budget is passed, the admins get an email. */
export async function recordUsage(usage: { input_tokens: number; output_tokens: number }, now = new Date()): Promise<void> {
  const usd = (usage.input_tokens * PRICE.input + usage.output_tokens * PRICE.output) / 1_000_000;
  const store = db();
  const ref = store.collection("aiMonthly").doc(month(now));
  const warn = await store.runTransaction(async (tx) => {
    const m = await tx.get(ref);
    const before = (m.get("usd") as number) ?? 0;
    const after = before + usd;
    const crossing = after >= STUDIO_LIMITS.monthlyAiBudgetUsd && !m.get("alertSent");
    tx.set(ref, { usd: after, calls: FieldValue.increment(1), ...(crossing ? { alertSent: true } : {}) }, { merge: true });
    return crossing ? after : null;
  });
  if (warn !== null) await warnAdmins(warn);
}

async function warnAdmins(usd: number): Promise<void> {
  const to = (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const text = `The AI budget for ${month()} has been reached: about $${usd.toFixed(2)} of $${STUDIO_LIMITS.monthlyAiBudgetUsd}. AI creation in the Studio is paused until next month or until the budget (AI_MONTHLY_BUDGET_USD) is raised.`;
  console.error(`[zukka] ${text}`);
  if (!mailerConfigured()) return;
  for (const addr of to)
    await sendEmail({ to: addr, subject: "Zukka: AI budget reached", text, html: `<p>${text}</p>` }).catch((e) => console.error("budget email not sent", e));
}

export async function monthSpend(now = new Date()): Promise<number> {
  return ((await db().collection("aiMonthly").doc(month(now)).get()).get("usd") as number) ?? 0;
}
