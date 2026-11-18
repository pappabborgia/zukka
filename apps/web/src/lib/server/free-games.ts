import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { assertGameSize, checkGameHtml, GameTooLargeError, MAX_GAME_BYTES, nameText, topicById, type GameProblem } from "@zukka/engines";
import { z } from "zod";
import { BUILTIN_HTML } from "@/generated/builtin-html";
import { STUDIO_LIMITS } from "../config/studio";
import { reserveGeneration } from "./ai-budget";
import { changeGame, GameAiError, generateGame, type FreeGameBrief, type GameResult } from "./ai-games";
import { db } from "./firebase";
import { checkCreatorTexts, getMyGame, GENERATION_TIMEOUT_MS, StudioError } from "./games";

/*
 * Free games: the parent describes a game and the AI writes it. Each result is a new immutable version
 * (kind "html"). Writing takes a while, so it runs after the page answers (Next.js after()):
 * the game document's "generation" field says running / done / failed, and the Studio page refreshes.
 */

/** The answers of the five steps of the free creation wizard (see components/FreeGameWizard.tsx). */
export const GAME_TYPES = ["race", "quiz", "puzzle", "adventure", "catch", "sports", "board", "other"] as const;
export const SETTINGS = ["space", "jungle", "ocean", "city", "castle", "farm", "stadium", "school", "other"] as const;
export const MOODS = ["bright", "cosy", "funny", "calm"] as const;
export const QUESTION_STYLES = ["choice", "typed", "mixed"] as const;
export const WIN_WAYS = ["finish", "points", "collect", "clock"] as const;
export const REWARDS = ["stars", "trophy", "badges", "none"] as const;

const short = (max: number) => z.string().trim().max(max).default("");

export const FreeBrief = z
  .object({
    // 1. the idea
    title: nameText(3, 40),
    gameType: z.enum(GAME_TYPES),
    description: z.string().trim().min(20, "describe the game in at least 20 characters").max(800),
    // 2. what it teaches
    subject: z.enum(["maths", "reading", "writing", "other"]),
    year: z.enum(["2", "3", "other"]),
    topics: z.array(z.string().max(40)).max(6).default([]),
    otherTopics: short(200),
    questionStyle: z.enum(QUESTION_STYLES),
    // 3. world and characters
    setting: z.enum(SETTINGS),
    settingOther: short(120),
    hero: short(160),
    others: short(200),
    mood: z.enum(MOODS),
    // 4. how it plays
    winBy: z.enum(WIN_WAYS),
    levels: z.coerce.number().int().min(3).max(6),
    minutes: z.coerce.number().int().refine((n) => [5, 7, 10].includes(n), "5, 7 or 10 minutes"),
    reward: z.enum(REWARDS),
    // 5. anything else
    extra: short(500),
  })
  .superRefine((b, ctx) => {
    if (b.subject === "other" && !b.otherTopics) ctx.addIssue({ code: "custom", path: ["otherTopics"], message: "say what the game teaches" });
    if (b.subject !== "other" && b.topics.length === 0 && !b.otherTopics)
      ctx.addIssue({ code: "custom", path: ["topics"], message: "choose at least one topic, or write one" });
    if (b.setting === "other" && !b.settingOther) ctx.addIssue({ code: "custom", path: ["settingOther"], message: "describe where the game happens" });
    for (const id of b.topics) {
      const t = topicById(id);
      if (!t || t.subject !== b.subject || (b.year !== "other" && !t.years.includes(Number(b.year) as 2 | 3)))
        ctx.addIssue({ code: "custom", path: ["topics"], message: `topic ${id} does not fit` });
    }
  });
export type FreeBrief = z.infer<typeof FreeBrief>;

const TYPE_TEXT: Record<(typeof GAME_TYPES)[number], string> = {
  race: "a race or runner: the player moves forward and answers to go faster or pass obstacles",
  quiz: "a quiz show with rounds, a host and a score",
  puzzle: "a puzzle: matching, sorting or completing pictures and words",
  adventure: "an adventure on a map: each place has a challenge to unlock the next one",
  catch: "a catch-and-collect game: tap or catch the right answers as they appear",
  sports: "a sports game: answers win points, passes or shots",
  board: "a board game: roll, move along a path, answer on each square",
  other: "the kind of game the parent describes",
};
const SETTING_TEXT: Record<(typeof SETTINGS)[number], string> = {
  space: "outer space", jungle: "a jungle", ocean: "under the sea", city: "a busy town", castle: "a castle",
  farm: "a farm", stadium: "a sports stadium", school: "a school", other: "",
};
const STYLE_TEXT = { choice: "multiple choice (tap one of 3 or 4 answers)", typed: "typed answers, checked by code", mixed: "mostly multiple choice, some typed answers" };
const MOOD_TEXT = { bright: "bright and colourful", cosy: "cosy and warm", funny: "funny and silly", calm: "calm and gentle" };
const WIN_TEXT = { finish: "reach the end", points: "score as many points as possible", collect: "collect all the items", clock: "beat the clock" };
const REWARD_TEXT = { stars: "1 to 3 stars at the end of each level", trophy: "a trophy when the game is finished", badges: "a badge for each level", none: "no extra rewards" };
export const ChangeRequest = z.string().trim().min(3, "say what you would like to change").max(600);

const games = () => db().collection("games");

function toBrief(b: FreeBrief): FreeGameBrief {
  const topics = b.topics.map((id) => topicById(id)!.label);
  if (b.otherTopics) topics.push(b.otherTopics);
  const lines = [
    `Kind of game: ${TYPE_TEXT[b.gameType]}.`,
    `What the game is about and its goal: ${b.description}`,
    `Questions: ${STYLE_TEXT[b.questionStyle]}.`,
    `Where it happens: ${b.setting === "other" ? b.settingOther : SETTING_TEXT[b.setting]}.`,
    b.hero ? `Main character: ${b.hero}` : "Main character: invent a friendly one.",
    b.others ? `Other characters (friends, helpers, opponents): ${b.others}` : "",
    `Look and mood: ${MOOD_TEXT[b.mood]}.`,
    `How to win: ${WIN_TEXT[b.winBy]}.`,
    `Levels: ${b.levels}, each a little harder than the one before. A whole play takes about ${b.minutes} minutes.`,
    `Rewards: ${REWARD_TEXT[b.reward]}.`,
    b.extra ? `Anything else: ${b.extra}` : "",
  ].filter(Boolean);
  return { title: b.title, description: lines.join("\n"), subject: b.subject, year: b.year, topics };
}

function parseBrief(raw: unknown): FreeBrief {
  const parsed = FreeBrief.safeParse(raw);
  if (!parsed.success) throw new StudioError("invalid", parsed.error.issues[0]?.message);
  const d = parsed.data;
  checkCreatorTexts([d.title, d.description, d.otherTopics, d.settingOther, d.hero, d.others, d.extra].filter(Boolean));
  return parsed.data;
}

/** Creates a free game from the wizard's answers. The AI writes it afterwards: call runCreate in after(). */
export async function createFreeGame(uid: string, raw: unknown): Promise<{ gameId: string }> {
  const brief = parseBrief(raw);
  await reserveGeneration(uid, null);
  const gameId = await insertGame(uid, {
    title: brief.title,
    subject: brief.subject,
    year: brief.year === "other" ? "other" : Number(brief.year),
    topics: brief.topics,
    description: brief.description,
    brief: JSON.stringify(brief),
    parentGameId: null,
    aiGenerations: 1,
    generation: { state: "running", kind: "create", request: null, message: null },
  });
  return { gameId };
}

/**
 * "Make your own version" of a catalogue game that has no quick form: version 1 is a copy of that game,
 * then the parent asks for changes. No AI is used until the first change.
 */
export async function createRemix(uid: string, rawTitle: unknown, source: { id: string; title: string; subjects: string[]; years: number[]; html: string }): Promise<{ gameId: string }> {
  const title = nameText(3, 40).safeParse(typeof rawTitle === "string" ? rawTitle.trim() : rawTitle);
  if (!title.success) throw new StudioError("invalid", "give the game a name of 3 to 40 letters");
  checkCreatorTexts([title.data]);
  const gameId = await insertGame(
    uid,
    {
      title: title.data,
      subject: source.subjects[0] ?? "other",
      year: source.years.length === 1 ? source.years[0] : "other",
      topics: [],
      description: `Your own version of ${source.title}`,
      brief: null,
      parentGameId: source.id,
      aiGenerations: 0,
      generation: null,
    },
    source.html,
  );
  return { gameId };
}

async function insertGame(uid: string, fields: Record<string, unknown> & { generation: Record<string, unknown> | null }, startHtml?: string): Promise<string> {
  const store = db();
  const gameRef = games().doc();
  const versionRef = gameRef.collection("versions").doc();
  await store.runTransaction(async (tx) => {
    const drafts = await tx.get(games().where("creatorUid", "==", uid).where("status", "==", "draft").limit(STUDIO_LIMITS.maxDrafts + 1));
    if (drafts.size >= STUDIO_LIMITS.maxDrafts) throw new StudioError("too_many_drafts");
    const now = FieldValue.serverTimestamp();
    tx.create(gameRef, {
      ...fields,
      creatorUid: uid,
      kind: "free",
      engine: null,
      status: "draft",
      currentVersionId: startHtml ? versionRef.id : null,
      versionCount: startHtml ? 1 : 0,
      generation: fields.generation ? { ...fields.generation, startedAt: now } : null,
      createdAt: now,
      updatedAt: now,
    });
    if (startHtml) {
      const bytes = assertGameSize(startHtml);
      tx.create(versionRef, { n: 1, kind: "html", engine: null, html: startHtml, bytes, problems: checkGameHtml(startHtml), note: "Copied from the original game", createdAt: now });
    }
  });
  return gameRef.id;
}

/** The starting HTML for "Make your own version" of a catalogue game without a quick form. */
export function builtinStartHtml(id: string): string | null {
  return Object.hasOwn(BUILTIN_HTML, id) ? BUILTIN_HTML[id] : null;
}

/** Asks for a change. The AI runs afterwards (call runChange in after()). */
export async function requestChange(uid: string, gameId: string, rawRequest: unknown): Promise<string> {
  const parsed = ChangeRequest.safeParse(rawRequest);
  if (!parsed.success) throw new StudioError("invalid", parsed.error.issues[0]?.message);
  const request = parsed.data;
  checkCreatorTexts([request]);
  const game = await getMyGame(uid, gameId);
  if (!game || game.kind !== "free") throw new StudioError("not_found");
  if (game.status !== "draft" && game.status !== "changes_requested") throw new StudioError("not_editable");
  if (game.generation?.state === "running") throw new StudioError("busy");
  if (!game.currentVersionId) throw new StudioError("invalid", "the game has no version yet");
  if (game.versionCount >= STUDIO_LIMITS.maxVersionsPerGame) throw new StudioError("too_many_versions");
  await reserveGeneration(uid, gameId);
  await games().doc(gameId).update({
    generation: { state: "running", kind: "change", request, message: null, startedAt: FieldValue.serverTimestamp() },
    updatedAt: FieldValue.serverTimestamp(),
  });
  return request;
}

async function saveResult(gameId: string, result: GameResult): Promise<void> {
  let bytes: number;
  try {
    bytes = assertGameSize(result.html);
  } catch (e) {
    if (e instanceof GameTooLargeError) throw new GameAiError(`The game came out too big (${Math.round(e.bytes / 1024)} KB, the limit is ${MAX_GAME_BYTES / 1024} KB). Ask for a simpler game.`);
    throw e;
  }
  const store = db();
  const gameRef = games().doc(gameId);
  await store.runTransaction(async (tx) => {
    const cur = await tx.get(gameRef);
    if (!cur.exists) return; // deleted meanwhile
    const n = (cur.get("versionCount") ?? 0) + 1;
    const versionRef = gameRef.collection("versions").doc();
    const now = FieldValue.serverTimestamp();
    tx.create(versionRef, { n, kind: "html", engine: null, html: result.html, bytes, problems: result.problems, note: result.note.slice(0, 160), createdAt: now });
    tx.update(gameRef, {
      currentVersionId: versionRef.id,
      versionCount: n,
      "generation.state": "done",
      "generation.message": null,
      updatedAt: now,
    });
  });
}

async function fail(gameId: string, e: unknown): Promise<void> {
  console.error(`free game ${gameId}: generation failed`, e);
  const message = e instanceof GameAiError ? e.message : "Something went wrong while the AI was working. Please try again.";
  await games()
    .doc(gameId)
    .update({ "generation.state": "failed", "generation.message": message, updatedAt: FieldValue.serverTimestamp() })
    .catch(() => {});
}

/** Writes the first version of a free game. Never throws: failures are stored on the game. */
export async function runCreate(gameId: string): Promise<void> {
  try {
    const snap = await games().doc(gameId).get();
    if (!snap.exists) return;
    const d = snap.data()!;
    const brief = FreeBrief.parse(JSON.parse(d.brief));
    await withTimeout(saveResult(gameId, await generateGame(toBrief(brief))));
  } catch (e) {
    await fail(gameId, e);
  }
}

/** Makes a new version with the parent's change. Never throws: failures are stored on the game. */
export async function runChange(gameId: string, request: string): Promise<void> {
  try {
    const gameRef = games().doc(gameId);
    const snap = await gameRef.get();
    if (!snap.exists) return;
    const v = await gameRef.collection("versions").doc(snap.get("currentVersionId")).get();
    if (!v.exists || typeof v.get("html") !== "string") throw new GameAiError("This version cannot be changed. Go back to another version and try again.");
    await withTimeout(saveResult(gameId, await changeGame(v.get("html"), request)));
  } catch (e) {
    await fail(gameId, e);
  }
}

async function withTimeout<T>(p: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<T>((_r, rej) => {
        timer = setTimeout(() => rej(new GameAiError("This took too long. Please try again, maybe with a simpler game.")), GENERATION_TIMEOUT_MS - 30_000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** The problems the static check found in the current version (for the Studio page). */
export async function currentProblems(gameId: string, versionId: string | null): Promise<GameProblem[]> {
  if (!versionId) return [];
  const v = await games().doc(gameId).collection("versions").doc(versionId).get();
  return (v.get("problems") as GameProblem[] | undefined) ?? [];
}
