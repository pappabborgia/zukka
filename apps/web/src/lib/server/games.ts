import "server-only";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import {
  buildQuickConfig,
  ENGINES,
  GameTooLargeError,
  MAX_GAME_BYTES,
  SchoolCupConfig,
  SchoolCupQuickForm,
  type ExtraQuestions,
  type SchoolCupQuickForm as QuickForm,
} from "@zukka/engines";
import { ENGINE_DEFAULTS } from "@/generated/engine-defaults";
import { BUILTIN_CATALOG } from "@/generated/builtin-catalog";
import { STUDIO_LIMITS } from "../config/studio";
import { checkProtectedNames, checkPublicText } from "../moderation";
import { db } from "./firebase";

/*
 * games/{gameId}                     a created game: owner, kind, engine, title, subject, year, topics, status
 * games/{gameId}/versions/{vid}      immutable versions: the config (as JSON text) or the HTML of a free game
 *
 * Every function takes the owner's account id from the session and checks it on the game.
 * Configs are stored as JSON text: Firestore cannot store arrays inside arrays.
 */

export type GameStatus = "draft" | "submitted" | "ai_reviewed" | "changes_requested" | "approved" | "rejected" | "removed";

export class StudioError extends Error {
  constructor(public code: "invalid" | "too_many_drafts" | "too_many_versions" | "not_found" | "not_editable" | "too_large" | "blocked_word" | "personal_data" | "protected_name", public detail?: string) {
    super(code);
  }
}

export interface GameSummary {
  id: string;
  title: string;
  kind: "quick" | "free";
  engine: string | null;
  subject: string;
  year: number;
  status: GameStatus;
  parentGameId: string | null;
  currentVersionId: string;
  versionCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GameVersion {
  id: string;
  n: number;
  kind: "config" | "html";
  engine: string | null;
  bytes: number;
  note: string;
  createdAt: Date;
}

const toDate = (v: unknown) => (v instanceof Timestamp ? v.toDate() : new Date(0));
const games = () => db().collection("games");

function summary(id: string, d: FirebaseFirestore.DocumentData): GameSummary {
  return {
    id,
    title: d.title,
    kind: d.kind,
    engine: d.engine ?? null,
    subject: d.subject,
    year: d.year,
    status: d.status,
    parentGameId: d.parentGameId ?? null,
    currentVersionId: d.currentVersionId,
    versionCount: d.versionCount ?? 1,
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
  };
}

/** Words parents type that children will see: length and characters are checked by the schema, words here. */
export function checkCreatorTexts(texts: string[]): void {
  for (const t of texts) {
    const m = checkPublicText(t);
    if (!m.ok) throw new StudioError(m.reason, t);
    const p = checkProtectedNames(t);
    if (!p.ok) throw new StudioError("protected_name", p.match);
  }
}

/** Size of the game once the config is put into the template, without building it. */
export function quickGameBytes(engine: string, configJson: string): number {
  const d = ENGINE_DEFAULTS[engine];
  return d.templateBytes - d.defaultConfigBytes + Buffer.byteLength(configJson);
}

function quickConfig(engine: string, rawForm: unknown, extra?: ExtraQuestions): { form: QuickForm; configJson: string; bytes: number } {
  if (engine !== "school-cup" || !ENGINES[engine]?.quick) throw new StudioError("invalid", "engine");
  const parsed = SchoolCupQuickForm.safeParse(rawForm);
  if (!parsed.success) throw new StudioError("invalid", parsed.error.issues[0]?.message);
  const form = parsed.data;
  checkCreatorTexts([form.title, form.tournamentName, form.teamName]);
  const base = SchoolCupConfig.parse(ENGINE_DEFAULTS[engine].defaultConfig);
  const config = buildQuickConfig(base, form, extra);
  const configJson = JSON.stringify(config);
  const bytes = quickGameBytes(engine, configJson);
  if (bytes > MAX_GAME_BYTES) throw new StudioError("too_large", String(new GameTooLargeError(bytes).message));
  return { form, configJson, bytes };
}

/** Builtin games and approved games can be the starting point of a new version ("Make your own version"). */
export async function parentGameInfo(id: string): Promise<{ id: string; title: string; engine: string | null } | null> {
  const builtin = BUILTIN_CATALOG.find((g) => g.id === id && g.listed);
  if (builtin) return { id: builtin.id, title: builtin.title, engine: builtin.engine };
  if (!/^[A-Za-z0-9]{10,40}$/.test(id)) return null;
  const snap = await games().doc(id).get();
  if (!snap.exists || snap.get("status") !== "approved") return null;
  return { id, title: snap.get("title"), engine: snap.get("engine") ?? null };
}

export async function createQuickGame(
  uid: string,
  engine: string,
  rawForm: unknown,
  opts: { parentGameId?: string | null; extra?: ExtraQuestions; note?: string; aiUsed?: boolean } = {},
): Promise<{ gameId: string; versionId: string }> {
  const { form, configJson, bytes } = quickConfig(engine, rawForm, opts.extra);
  const store = db();
  const gameRef = games().doc();
  const versionRef = gameRef.collection("versions").doc();
  await store.runTransaction(async (tx) => {
    const drafts = await tx.get(games().where("creatorUid", "==", uid).where("status", "==", "draft").limit(STUDIO_LIMITS.maxDrafts + 1));
    if (drafts.size >= STUDIO_LIMITS.maxDrafts) throw new StudioError("too_many_drafts");
    const now = FieldValue.serverTimestamp();
    tx.create(gameRef, {
      creatorUid: uid,
      kind: "quick",
      engine,
      title: form.title,
      subject: form.subject,
      year: form.year,
      topics: form.topics,
      quickForm: JSON.stringify(form),
      status: "draft",
      parentGameId: opts.parentGameId ?? null,
      currentVersionId: versionRef.id,
      versionCount: 1,
      aiGenerations: opts.aiUsed ? 1 : 0,
      createdAt: now,
      updatedAt: now,
    });
    tx.create(versionRef, { n: 1, kind: "config", engine, configJson, bytes, note: (opts.note ?? "First version").slice(0, 120), createdAt: now });
  });
  return { gameId: gameRef.id, versionId: versionRef.id };
}

/** Only drafts and games sent back for changes can get new versions. */
const EDITABLE: GameStatus[] = ["draft", "changes_requested"];

export async function addQuickVersion(uid: string, gameId: string, rawForm: unknown, note = "Changed in the form", extra?: ExtraQuestions): Promise<string> {
  const game = await getMyGame(uid, gameId);
  if (!game) throw new StudioError("not_found");
  if (game.kind !== "quick" || !game.engine) throw new StudioError("invalid");
  const { form, configJson, bytes } = quickConfig(game.engine, rawForm, extra);
  const store = db();
  const gameRef = games().doc(gameId);
  const versionRef = gameRef.collection("versions").doc();
  await store.runTransaction(async (tx) => {
    const cur = await tx.get(gameRef);
    if (!cur.exists || cur.get("creatorUid") !== uid) throw new StudioError("not_found");
    if (!EDITABLE.includes(cur.get("status"))) throw new StudioError("not_editable");
    const n = (cur.get("versionCount") ?? 1) + 1;
    if (n > STUDIO_LIMITS.maxVersionsPerGame) throw new StudioError("too_many_versions");
    const now = FieldValue.serverTimestamp();
    tx.create(versionRef, { n, kind: "config", engine: game.engine, configJson, bytes, note: note.slice(0, 120), createdAt: now });
    tx.update(gameRef, {
      title: form.title,
      subject: form.subject,
      year: form.year,
      topics: form.topics,
      quickForm: JSON.stringify(form),
      currentVersionId: versionRef.id,
      versionCount: n,
      updatedAt: now,
    });
  });
  return versionRef.id;
}

/** Go back to an earlier version: it becomes the current one again (nothing is deleted). */
export async function restoreVersion(uid: string, gameId: string, versionId: string): Promise<void> {
  const store = db();
  const gameRef = games().doc(gameId);
  await store.runTransaction(async (tx) => {
    const cur = await tx.get(gameRef);
    if (!cur.exists || cur.get("creatorUid") !== uid) throw new StudioError("not_found");
    if (!EDITABLE.includes(cur.get("status"))) throw new StudioError("not_editable");
    const v = await tx.get(gameRef.collection("versions").doc(versionId));
    if (!v.exists) throw new StudioError("not_found");
    const update: Record<string, unknown> = { currentVersionId: versionId, updatedAt: FieldValue.serverTimestamp() };
    if (v.get("kind") === "config" && cur.get("kind") === "quick") {
      const cfg = JSON.parse(v.get("configJson"));
      update.title = cfg.title;
    }
    tx.update(gameRef, update);
  });
}

export async function listMyGames(uid: string): Promise<GameSummary[]> {
  const snap = await games().where("creatorUid", "==", uid).get();
  return snap.docs.map((d) => summary(d.id, d.data())).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export async function getMyGame(uid: string, gameId: string): Promise<(GameSummary & { quickForm: QuickForm | null }) | null> {
  if (!/^[A-Za-z0-9]{10,40}$/.test(gameId)) return null;
  const snap = await games().doc(gameId).get();
  if (!snap.exists || snap.get("creatorUid") !== uid) return null;
  const d = snap.data()!;
  return { ...summary(snap.id, d), quickForm: d.quickForm ? JSON.parse(d.quickForm) : null };
}

export async function listVersions(uid: string, gameId: string): Promise<GameVersion[]> {
  const game = await getMyGame(uid, gameId);
  if (!game) throw new StudioError("not_found");
  const snap = await games().doc(gameId).collection("versions").orderBy("n", "desc").get();
  return snap.docs.map((d) => {
    const v = d.data();
    return { id: d.id, n: v.n, kind: v.kind, engine: v.engine ?? null, bytes: v.bytes, note: v.note ?? "", createdAt: toDate(v.createdAt) };
  });
}

/** A draft can be deleted by its owner, with all its versions. */
export async function deleteDraft(uid: string, gameId: string): Promise<void> {
  const game = await getMyGame(uid, gameId);
  if (!game) throw new StudioError("not_found");
  if (!["draft", "changes_requested", "rejected"].includes(game.status)) throw new StudioError("not_editable");
  await db().recursiveDelete(games().doc(gameId));
}

/** All games of an account (used when the account is deleted). */
export async function deleteAllGamesOf(uid: string): Promise<number> {
  const snap = await games().where("creatorUid", "==", uid).get();
  for (const d of snap.docs) await db().recursiveDelete(d.ref);
  return snap.size;
}
