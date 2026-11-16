"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SchoolCupQuickForm, type ExtraQuestions } from "@zukka/engines";
import { AiLimitError, aiConfigured, reserveGeneration } from "@/lib/server/ai-budget";
import { generateExtras } from "@/lib/server/ai-questions";
import { addQuickVersion, createQuickGame, deleteDraft, parentGameInfo, restoreVersion, StudioError } from "@/lib/server/games";
import { requireParent } from "@/lib/server/guards";
import type { FormState } from "./auth";

const MESSAGES: Record<string, string> = {
  invalid: "Please check the form: something is missing or not valid.",
  too_many_drafts: "You already have 5 games in draft. Finish or delete one first.",
  too_many_versions: "This game has reached the maximum number of versions. Start a new game instead.",
  not_found: "We could not find this game.",
  not_editable: "This game cannot be changed now (it is in review or published).",
  too_large: "This game is too big to save (the limit is 700 KB).",
  blocked_word: "One of the names contains a word we do not allow. Please choose another.",
  personal_data: "Please do not put emails, phone numbers or links in the names.",
  protected_name: "One of the names looks like a real team, brand or character. Please make up your own.",
};

const AI_MESSAGES: Record<string, string> = {
  per_game: "This game has used all its AI questions. Untick the AI box to save without new ones.",
  per_day: "You have used today's AI questions. Untick the AI box, or try again tomorrow.",
  budget: "AI questions are paused for this month. Untick the AI box to save without them.",
  not_configured: "AI questions are not available here. Untick the AI box.",
};

function message(e: unknown): string {
  if (e instanceof AiLimitError) return AI_MESSAGES[e.code];
  if (e instanceof StudioError) {
    if (e.code === "invalid" && e.detail) return `Please check the form: ${e.detail}.`;
    if (e.code === "protected_name" && e.detail) return `"${e.detail}" belongs to someone else. Please make up your own names.`;
    return MESSAGES[e.code] ?? MESSAGES.invalid;
  }
  console.error("studio error", e);
  return "Something went wrong. Please try again.";
}

/** Reads the quick form fields (the same for School Cup new games and new versions). */
function quickFormFrom(form: FormData) {
  return {
    title: String(form.get("title") ?? "").trim(),
    tournamentName: String(form.get("tournamentName") ?? "").trim(),
    teamName: String(form.get("teamName") ?? "").trim(),
    colour1: String(form.get("colour1") ?? ""),
    colour2: String(form.get("colour2") ?? ""),
    pattern: String(form.get("pattern") ?? ""),
    subject: String(form.get("subject") ?? ""),
    year: Number(form.get("year")),
    topics: form.getAll("topics").map(String),
    tables: form.getAll("tables").map(Number),
  };
}

/**
 * When the AI box is ticked: checks the limits, then asks Claude for extra questions on the chosen topics.
 * Returns nothing when the box is not ticked or the form is not valid yet (the save reports the form error).
 */
async function aiExtras(uid: string, gameId: string | null, form: FormData): Promise<{ extra?: ExtraQuestions; note?: string }> {
  if (form.get("ai") !== "on" || !aiConfigured()) return {};
  const parsed = SchoolCupQuickForm.safeParse(quickFormFrom(form));
  if (!parsed.success) return {};
  await reserveGeneration(uid, gameId);
  const { extra, added } = await generateExtras(parsed.data);
  return { extra, note: added ? `${added} questions written by AI` : "AI questions could not be added this time" };
}

export async function createQuick(_prev: FormState, form: FormData): Promise<FormState> {
  const acc = await requireParent("/studio");
  const engine = String(form.get("engine") ?? "");
  const from = String(form.get("parentGameId") ?? "");
  let parentGameId: string | null = null;
  if (from) {
    const parent = await parentGameInfo(from);
    if (!parent || parent.engine !== engine) return { error: "The game you started from is not available." };
    parentGameId = parent.id;
  }
  let gameId: string;
  try {
    const ai = await aiExtras(acc.uid, null, form);
    ({ gameId } = await createQuickGame(acc.uid, engine, quickFormFrom(form), {
      parentGameId,
      extra: ai.extra,
      aiUsed: !!ai.extra,
      note: ai.note ? `First version · ${ai.note}` : undefined,
    }));
  } catch (e) {
    return { error: message(e) };
  }
  revalidatePath("/studio");
  redirect(`/studio/games/${gameId}`);
}

export async function saveQuickVersion(_prev: FormState, form: FormData): Promise<FormState> {
  const acc = await requireParent("/studio");
  const gameId = String(form.get("gameId") ?? "");
  try {
    const ai = await aiExtras(acc.uid, gameId, form);
    await addQuickVersion(acc.uid, gameId, quickFormFrom(form), ai.note ? `Changed in the form · ${ai.note}` : undefined, ai.extra);
  } catch (e) {
    return { error: message(e) };
  }
  revalidatePath(`/studio/games/${gameId}`);
  redirect(`/studio/games/${gameId}`);
}

export async function chooseVersion(form: FormData): Promise<void> {
  const acc = await requireParent("/studio");
  const gameId = String(form.get("gameId") ?? "");
  try {
    await restoreVersion(acc.uid, gameId, String(form.get("versionId") ?? ""));
  } catch {
    // shown as unchanged
  }
  revalidatePath(`/studio/games/${gameId}`);
  redirect(`/studio/games/${gameId}`);
}

export async function removeDraft(form: FormData): Promise<void> {
  const acc = await requireParent("/studio");
  try {
    await deleteDraft(acc.uid, String(form.get("gameId") ?? ""));
  } catch {
    // already gone or not deletable
  }
  revalidatePath("/studio");
  redirect("/studio");
}
