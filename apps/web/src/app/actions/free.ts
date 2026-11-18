"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { BUILTIN_CATALOG } from "@/generated/builtin-catalog";
import { AiLimitError } from "@/lib/server/ai-budget";
import { builtinStartHtml, createFreeGame, createRemix, requestChange, retryCreate, runChange, runCreate } from "@/lib/server/free-games";
import { StudioError } from "@/lib/server/games";
import { requireParent } from "@/lib/server/guards";
import type { FormState } from "./auth";

const STUDIO: Record<string, string> = {
  invalid: "Please check your answers: something is missing or not valid.",
  too_many_drafts: "You already have 5 games in draft. Finish or delete one first.",
  too_many_versions: "This game has reached the maximum number of versions. Start a new game instead.",
  not_found: "We could not find this game.",
  not_editable: "This game cannot be changed now (it is in review or published).",
  busy: "The AI is still working on this game. Wait for it to finish.",
  blocked_word: "Your text contains a word we do not allow. Please change it.",
  personal_data: "Please do not write emails, phone numbers or links.",
  protected_name: "Your text names something that belongs to someone else. Please make up your own.",
};
const AI: Record<string, string> = {
  per_game: "This game has used all its AI changes (10). Start a new game to keep going.",
  per_day: "You have used today's AI requests (10). Please try again tomorrow.",
  budget: "The AI is paused for this month. Please try again next month.",
  not_configured: "The AI is not available here.",
};

function message(e: unknown): string {
  if (e instanceof AiLimitError) return AI[e.code];
  if (e instanceof StudioError) {
    if (e.code === "invalid" && e.detail) return `Please check your answers: ${e.detail}.`;
    if (e.code === "protected_name" && e.detail) return `"${e.detail}" belongs to someone else. Please make up your own.`;
    return STUDIO[e.code] ?? STUDIO.invalid;
  }
  console.error("free creation error", e);
  return "Something went wrong. Please try again.";
}

const text = (form: FormData, k: string) => String(form.get(k) ?? "").trim();

/** The wizard's answers (see components/FreeGameWizard.tsx). */
function briefFrom(form: FormData) {
  return {
    title: text(form, "title"),
    gameType: text(form, "gameType"),
    description: text(form, "description"),
    subject: text(form, "subject"),
    year: text(form, "year"),
    topics: form.getAll("topics").map(String),
    otherTopics: text(form, "otherTopics"),
    questionStyle: text(form, "questionStyle"),
    setting: text(form, "setting"),
    settingOther: text(form, "settingOther"),
    hero: text(form, "hero"),
    others: text(form, "others"),
    mood: text(form, "mood"),
    winBy: text(form, "winBy"),
    levels: text(form, "levels"),
    minutes: text(form, "minutes"),
    reward: text(form, "reward"),
    extra: text(form, "extra"),
  };
}

/** Last step of the wizard: the game is created and the AI starts writing it. */
export async function createFree(_prev: FormState, form: FormData): Promise<FormState> {
  const acc = await requireParent("/studio/new/free");
  if (form.get("rules") !== "on") return { error: "Please confirm the rules before creating the game." };
  let gameId: string;
  try {
    ({ gameId } = await createFreeGame(acc.uid, briefFrom(form)));
  } catch (e) {
    return { error: message(e) };
  }
  after(() => runCreate(gameId)); // keeps running after the page has answered (up to the route's maxDuration)
  revalidatePath("/studio");
  redirect(`/studio/games/${gameId}`);
}

/** "Make your own version" of a catalogue game without a quick form: a copy to change. */
export async function createFreeRemix(_prev: FormState, form: FormData): Promise<FormState> {
  const acc = await requireParent("/studio/new");
  const from = text(form, "from");
  const source = BUILTIN_CATALOG.find((g) => g.id === from && g.listed);
  const html = source ? builtinStartHtml(source.id) : null;
  if (!source || !html) return { error: "This game cannot be copied." };
  let gameId: string;
  try {
    ({ gameId } = await createRemix(acc.uid, form.get("title"), { id: source.id, title: source.title, subjects: source.subjects, years: source.years, html }));
  } catch (e) {
    return { error: message(e) };
  }
  revalidatePath("/studio");
  redirect(`/studio/games/${gameId}`);
}

/** "What would you like to change?" */
export async function askForChange(_prev: FormState, form: FormData): Promise<FormState> {
  const acc = await requireParent("/studio");
  const gameId = text(form, "gameId");
  let request: string;
  try {
    request = await requestChange(acc.uid, gameId, form.get("request"));
  } catch (e) {
    return { error: message(e) };
  }
  after(() => runChange(gameId, request));
  revalidatePath(`/studio/games/${gameId}`);
  redirect(`/studio/games/${gameId}`);
}

/** "Try again" after the first build failed. */
export async function tryCreateAgain(_prev: FormState, form: FormData): Promise<FormState> {
  const acc = await requireParent("/studio");
  const gameId = text(form, "gameId");
  try {
    await retryCreate(acc.uid, gameId);
  } catch (e) {
    return { error: message(e) };
  }
  after(() => runCreate(gameId));
  revalidatePath(`/studio/games/${gameId}`);
  redirect(`/studio/games/${gameId}`);
}
