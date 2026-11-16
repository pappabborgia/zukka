import "server-only";
import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import { isAvatarId, type AvatarId } from "../avatars";
import { checkCreatorNickname } from "../moderation";
import { isNicknameParts, nicknameKey, nicknameText, type NicknameParts } from "../nicknames";
import { MAX_PLAYERS_PER_ACCOUNT, POLICY_VERSION } from "../policies";
import { isSchoolYear, type SchoolYear } from "../school-years";
import { adminAuth, db } from "./firebase";
import { deleteAllGamesOf } from "./games";
import { checkPin, hashPin, isValidPin, PIN_LOCK_MINUTES, PIN_MAX_FAILS } from "./pin";

/*
 * Data model (Firestore). Every function takes the account id from the session, never from the browser,
 * and every path starts at accounts/{uid}, so one account can never reach another account's data.
 *
 * accounts/{uid}                     consent, PIN hash, creator nickname. No email: it lives only in Firebase Auth.
 * accounts/{uid}/consents/{id}       history of accepted policy versions
 * accounts/{uid}/players/{pid}       child profiles: nickname (from lists), avatar, school year, leaderboard choice
 * nicknames/{key}                    reservation that keeps child nicknames unique
 * creatorNicknames/{key}             reservation that keeps creator nicknames unique
 */

export type ErrorCode =
  | "no_account"
  | "already_exists"
  | "invalid"
  | "too_many_players"
  | "nickname_taken"
  | "not_found"
  | "pin_locked"
  | "wrong_pin"
  | "blocked_word"
  | "personal_data";

export class AccountError extends Error {
  constructor(public code: ErrorCode, public extra?: Record<string, unknown>) {
    super(code);
  }
}

export interface Account {
  uid: string;
  createdAt: Date;
  consent: { adult: true; childProfiles: true; policyVersion: string; acceptedAt: Date };
  creatorNickname: string | null;
  hasPin: boolean;
}

export interface Player {
  id: string;
  nickname: NicknameParts;
  nicknameText: string;
  avatar: AvatarId;
  schoolYear: SchoolYear;
  showOnLeaderboards: boolean;
  createdAt: Date;
}

export interface PlayerInput {
  nickname: NicknameParts;
  avatar: AvatarId;
  schoolYear: SchoolYear;
  showOnLeaderboards: boolean;
}

const accountRef = (store: Firestore, uid: string) => store.collection("accounts").doc(uid);
const playersRef = (store: Firestore, uid: string) => accountRef(store, uid).collection("players");
const toDate = (v: unknown) => (v instanceof Timestamp ? v.toDate() : new Date(0));

export function validatePlayerInput(v: unknown): PlayerInput {
  const p = v as Partial<PlayerInput> | null;
  if (
    !p ||
    !isNicknameParts(p.nickname) ||
    !isAvatarId(p.avatar) ||
    !isSchoolYear(p.schoolYear) ||
    typeof p.showOnLeaderboards !== "boolean"
  )
    throw new AccountError("invalid");
  return {
    nickname: { adjective: p.nickname.adjective, animal: p.nickname.animal, number: p.nickname.number },
    avatar: p.avatar,
    schoolYear: p.schoolYear,
    showOnLeaderboards: p.showOnLeaderboards,
  };
}

/* ---------- account ---------- */

export async function getAccount(uid: string): Promise<Account | null> {
  const snap = await accountRef(db(), uid).get();
  if (!snap.exists) return null;
  const d = snap.data()!;
  return {
    uid,
    createdAt: toDate(d.createdAt),
    consent: { ...d.consent, acceptedAt: toDate(d.consent?.acceptedAt) },
    creatorNickname: d.creatorNickname ?? null,
    hasPin: !!d.pinHash,
  };
}

/**
 * Creates the account after the parent confirms being an adult, consents to creating profiles
 * for their children and accepts the policies. The consent is recorded with date and version.
 */
export async function createAccount(uid: string, input: { adult: boolean; childProfiles: boolean; policies: boolean; pin: string }) {
  if (input.adult !== true || input.childProfiles !== true || input.policies !== true) throw new AccountError("invalid");
  if (!isValidPin(input.pin)) throw new AccountError("invalid");
  const store = db();
  const pinHash = await hashPin(input.pin);
  await store.runTransaction(async (tx) => {
    const ref = accountRef(store, uid);
    if ((await tx.get(ref)).exists) throw new AccountError("already_exists");
    const consent = { adult: true, childProfiles: true, policyVersion: POLICY_VERSION, acceptedAt: FieldValue.serverTimestamp() };
    tx.create(ref, { createdAt: FieldValue.serverTimestamp(), consent, pinHash, pinFails: 0, pinLockedUntil: null, creatorNickname: null });
    tx.create(ref.collection("consents").doc(), { ...consent, kind: "signup" });
  });
}

/* ---------- PIN ---------- */

/** Checks the PIN; after 5 wrong tries the PIN is locked for 15 minutes (the email link still works). */
export async function verifyPin(uid: string, pin: string, now = new Date()): Promise<void> {
  const store = db();
  const ref = accountRef(store, uid);
  const snap = await ref.get();
  if (!snap.exists) throw new AccountError("no_account");
  const lockedUntil = snap.get("pinLockedUntil") as Timestamp | null;
  if (lockedUntil && lockedUntil.toDate() > now) throw new AccountError("pin_locked", { until: lockedUntil.toDate() });
  const ok = await checkPin(pin, snap.get("pinHash"));
  await store.runTransaction(async (tx) => {
    const cur = await tx.get(ref);
    if (ok) {
      tx.update(ref, { pinFails: 0, pinLockedUntil: null });
      return;
    }
    const fails = ((cur.get("pinFails") as number) ?? 0) + 1;
    tx.update(ref, {
      pinFails: fails >= PIN_MAX_FAILS ? 0 : fails,
      pinLockedUntil: fails >= PIN_MAX_FAILS ? Timestamp.fromMillis(now.getTime() + PIN_LOCK_MINUTES * 60_000) : null,
    });
  });
  if (!ok) throw new AccountError("wrong_pin");
}

export async function setPin(uid: string, pin: string): Promise<void> {
  if (!isValidPin(pin)) throw new AccountError("invalid");
  await accountRef(db(), uid).update({ pinHash: await hashPin(pin), pinFails: 0, pinLockedUntil: null });
}

/* ---------- creator nickname ---------- */

export async function setCreatorNickname(uid: string, raw: string): Promise<string> {
  const check = checkCreatorNickname(raw);
  if (!check.ok) throw new AccountError(check.reason === "blocked_word" || check.reason === "personal_data" ? check.reason : "invalid");
  const store = db();
  const key = check.value.toLowerCase();
  await store.runTransaction(async (tx) => {
    const ref = accountRef(store, uid);
    const acc = await tx.get(ref);
    if (!acc.exists) throw new AccountError("no_account");
    const res = store.collection("creatorNicknames").doc(key);
    const taken = await tx.get(res);
    if (taken.exists && taken.get("uid") !== uid) throw new AccountError("nickname_taken");
    const old = acc.get("creatorNickname") as string | null;
    if (old && old.toLowerCase() !== key) tx.delete(store.collection("creatorNicknames").doc(old.toLowerCase()));
    tx.set(res, { uid });
    tx.update(ref, { creatorNickname: check.value });
  });
  return check.value;
}

/* ---------- child profiles ---------- */

function toPlayer(id: string, d: FirebaseFirestore.DocumentData): Player {
  return {
    id,
    nickname: d.nickname,
    nicknameText: d.nicknameText,
    avatar: d.avatar,
    schoolYear: d.schoolYear,
    showOnLeaderboards: d.showOnLeaderboards === true,
    createdAt: toDate(d.createdAt),
  };
}

export async function listPlayers(uid: string): Promise<Player[]> {
  const snap = await playersRef(db(), uid).orderBy("createdAt").get();
  return snap.docs.map((d) => toPlayer(d.id, d.data()));
}

export async function getPlayer(uid: string, pid: string): Promise<Player | null> {
  if (!/^[A-Za-z0-9]{1,40}$/.test(pid)) return null;
  const snap = await playersRef(db(), uid).doc(pid).get();
  return snap.exists ? toPlayer(snap.id, snap.data()!) : null;
}

export async function createPlayer(uid: string, raw: unknown): Promise<Player> {
  const input = validatePlayerInput(raw);
  const store = db();
  const ref = playersRef(store, uid).doc();
  const key = nicknameKey(input.nickname);
  await store.runTransaction(async (tx) => {
    const acc = await tx.get(accountRef(store, uid));
    if (!acc.exists) throw new AccountError("no_account");
    const existing = await tx.get(playersRef(store, uid).limit(MAX_PLAYERS_PER_ACCOUNT + 1));
    if (existing.size >= MAX_PLAYERS_PER_ACCOUNT) throw new AccountError("too_many_players");
    const res = store.collection("nicknames").doc(key);
    if ((await tx.get(res)).exists) throw new AccountError("nickname_taken");
    tx.create(res, { uid, pid: ref.id });
    tx.create(ref, { ...input, nicknameText: nicknameText(input.nickname), createdAt: FieldValue.serverTimestamp() });
  });
  return (await getPlayer(uid, ref.id))!;
}

export async function updatePlayer(uid: string, pid: string, raw: unknown): Promise<void> {
  const input = validatePlayerInput(raw);
  const store = db();
  const ref = playersRef(store, uid).doc(pid);
  await store.runTransaction(async (tx) => {
    const cur = await tx.get(ref);
    if (!cur.exists) throw new AccountError("not_found");
    const oldKey = nicknameKey(cur.get("nickname") as NicknameParts);
    const newKey = nicknameKey(input.nickname);
    if (oldKey !== newKey) {
      const res = store.collection("nicknames").doc(newKey);
      if ((await tx.get(res)).exists) throw new AccountError("nickname_taken");
      tx.create(res, { uid, pid });
      tx.delete(store.collection("nicknames").doc(oldKey));
    }
    tx.update(ref, { ...input, nicknameText: nicknameText(input.nickname) });
  });
}

/** Deletes a child profile and everything stored under it. */
export async function deletePlayer(uid: string, pid: string): Promise<void> {
  const store = db();
  const ref = playersRef(store, uid).doc(pid);
  const snap = await ref.get();
  if (!snap.exists) throw new AccountError("not_found");
  await store.collection("nicknames").doc(nicknameKey(snap.get("nickname") as NicknameParts)).delete();
  await store.recursiveDelete(ref);
}

/** Is this nickname free? (for the picker) */
export async function nicknameAvailable(n: NicknameParts): Promise<boolean> {
  return !(await db().collection("nicknames").doc(nicknameKey(n)).get()).exists;
}

/* ---------- export and delete ---------- */

/** Everything Zukka keeps about this account and its children, as plain JSON. */
export async function exportAccount(uid: string): Promise<Record<string, unknown>> {
  const store = db();
  const user = await adminAuth().getUser(uid);
  const acc = await accountRef(store, uid).get();
  const consents = await accountRef(store, uid).collection("consents").get();
  const players = await playersRef(store, uid).get();
  const iso = (v: unknown) => (v instanceof Timestamp ? v.toDate().toISOString() : v);
  const clean = (d: FirebaseFirestore.DocumentData) => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, iso(v)]));
  const a = acc.data() ?? {};
  return {
    exportedAt: new Date().toISOString(),
    account: {
      email: user.email,
      createdAt: iso(a.createdAt),
      consent: a.consent ? clean(a.consent) : null,
      creatorNickname: a.creatorNickname ?? null,
      pin: a.pinHash ? "set (stored only as a hash)" : "not set",
    },
    consentHistory: consents.docs.map((d) => clean(d.data())),
    players: players.docs.map((d) => ({ id: d.id, ...clean(d.data()) })),
    games: (await store.collection("games").where("creatorUid", "==", uid).get()).docs.map((d) => ({
      id: d.id,
      title: d.get("title"),
      kind: d.get("kind"),
      status: d.get("status"),
      versions: d.get("versionCount"),
      createdAt: iso(d.get("createdAt")),
    })),
  };
}

/** Deletes the account, all its children's profiles and data, its reservations and the sign-in itself. */
export async function deleteAccount(uid: string): Promise<void> {
  const store = db();
  const ref = accountRef(store, uid);
  await deleteAllGamesOf(uid);
  const nick = await store.collection("nicknames").where("uid", "==", uid).get();
  const creator = await store.collection("creatorNicknames").where("uid", "==", uid).get();
  const batch = store.batch();
  for (const d of [...nick.docs, ...creator.docs]) batch.delete(d.ref);
  await batch.commit();
  await store.recursiveDelete(ref);
  await adminAuth()
    .deleteUser(uid)
    .catch((e: { code?: string }) => {
      if (e?.code !== "auth/user-not-found") throw e;
    });
}
