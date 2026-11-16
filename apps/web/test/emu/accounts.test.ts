import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  AccountError,
  createAccount,
  createPlayer,
  deleteAccount,
  deletePlayer,
  exportAccount,
  getAccount,
  getPlayer,
  listPlayers,
  setCreatorNickname,
  updatePlayer,
  verifyPin,
} from "../../src/lib/server/accounts";
import { completeSignIn, createSignInLink } from "../../src/lib/server/email-link";
import { adminAuth, db } from "../../src/lib/server/firebase";
import { hit } from "../../src/lib/server/rate-limit";
import { POLICY_VERSION } from "../../src/lib/policies";

const PROJECT = "demo-zukka";
let rules: RulesTestEnvironment;

const consent = { adult: true, childProfiles: true, policies: true, pin: "2468" };
const kid = (number: number, extra: Record<string, unknown> = {}) => ({
  nickname: { adjective: "Sunny", animal: "Otter", number },
  avatar: "fox",
  schoolYear: "y2",
  showOnLeaderboards: false,
  ...extra,
});

async function newUser(email: string): Promise<string> {
  return (await adminAuth().createUser({ email })).uid;
}

async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "ok";
  } catch (e) {
    return e instanceof AccountError ? e.code : String(e);
  }
}

beforeAll(async () => {
  rules = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: readFileSync("firebase/firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
});
afterAll(async () => {
  await rules.cleanup();
});
beforeEach(async () => {
  await rules.clearFirestore();
  await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${PROJECT}/accounts`, { method: "DELETE" });
});

describe("Firestore rules: browsers can reach nothing", () => {
  it("denies reads and writes, signed in or not, own data included", async () => {
    const uid = await newUser("rules@example.com");
    await createAccount(uid, consent);
    const owner = rules.authenticatedContext(uid).firestore();
    const stranger = rules.unauthenticatedContext().firestore();
    await assertFails(owner.doc(`accounts/${uid}`).get());
    await assertFails(owner.doc(`accounts/${uid}`).set({ creatorNickname: "x" }));
    await assertFails(owner.collection(`accounts/${uid}/players`).get());
    await assertFails(stranger.doc(`accounts/${uid}`).get());
    await assertFails(stranger.collection("nicknames").get());
  });
});

describe("account and consent", () => {
  it("is created only with every consent, and records version and date", async () => {
    const uid = await newUser("a@example.com");
    expect(await code(createAccount(uid, { ...consent, adult: false }))).toBe("invalid");
    expect(await code(createAccount(uid, { ...consent, childProfiles: false }))).toBe("invalid");
    expect(await code(createAccount(uid, { ...consent, pin: "12" }))).toBe("invalid");
    expect(await code(createAccount(uid, consent))).toBe("ok");
    expect(await code(createAccount(uid, consent))).toBe("already_exists");
    const acc = await getAccount(uid);
    expect(acc?.consent).toMatchObject({ adult: true, childProfiles: true, policyVersion: POLICY_VERSION });
    expect(acc?.consent.acceptedAt.getTime()).toBeGreaterThan(Date.now() - 60_000);
    const raw = (await db().doc(`accounts/${uid}`).get()).data()!;
    expect(JSON.stringify(raw)).not.toContain("a@example.com");
    expect(raw.pinHash).toMatch(/^scrypt\$/);
    expect((await db().collection(`accounts/${uid}/consents`).get()).size).toBe(1);
  });
});

describe("child profiles", () => {
  it("allow at most 5 per account", async () => {
    const uid = await newUser("five@example.com");
    await createAccount(uid, consent);
    for (let i = 1; i <= 5; i++) await createPlayer(uid, kid(i));
    expect(await code(createPlayer(uid, kid(6)))).toBe("too_many_players");
    expect(await listPlayers(uid)).toHaveLength(5);
  });

  it("keep nicknames unique across accounts and free them on delete", async () => {
    const a = await newUser("a@example.com");
    const b = await newUser("b@example.com");
    await createAccount(a, consent);
    await createAccount(b, consent);
    const p = await createPlayer(a, kid(7));
    expect(p.nicknameText).toBe("SunnyOtter7");
    expect(await code(createPlayer(b, kid(7)))).toBe("nickname_taken");
    await deletePlayer(a, p.id);
    expect(await code(createPlayer(b, kid(7)))).toBe("ok");
  });

  it("refuse anything that is not from the lists or the gallery", async () => {
    const uid = await newUser("x@example.com");
    await createAccount(uid, consent);
    expect(await code(createPlayer(uid, kid(1, { nickname: { adjective: "Sunny", animal: "Luca", number: 1 } })))).toBe("invalid");
    expect(await code(createPlayer(uid, kid(1, { avatar: "photo.jpg" })))).toBe("invalid");
    expect(await code(createPlayer(uid, kid(1, { schoolYear: "y9" })))).toBe("invalid");
    expect(await code(createPlayer(uid, kid(1, { showOnLeaderboards: "yes" })))).toBe("invalid");
    expect(await code(createPlayer(uid, { ...kid(1), realName: "Luca Rossi" }))).toBe("ok");
    const stored = (await db().collection(`accounts/${uid}/players`).get()).docs[0].data();
    expect(stored.realName).toBeUndefined();
  });

  it("need an account first", async () => {
    const uid = await newUser("noacc@example.com");
    expect(await code(createPlayer(uid, kid(1)))).toBe("no_account");
  });

  it("cannot be read, changed or deleted by another account", async () => {
    const a = await newUser("a@example.com");
    const b = await newUser("b@example.com");
    await createAccount(a, consent);
    await createAccount(b, consent);
    const p = await createPlayer(a, kid(3));
    expect(await getPlayer(b, p.id)).toBeNull();
    expect(await code(updatePlayer(b, p.id, kid(4)))).toBe("not_found");
    expect(await code(deletePlayer(b, p.id))).toBe("not_found");
    expect(await listPlayers(b)).toEqual([]);
    expect((await getPlayer(a, p.id))?.nicknameText).toBe("SunnyOtter3");
  });

  it("can change nickname, avatar, year and leaderboard choice", async () => {
    const uid = await newUser("c@example.com");
    await createAccount(uid, consent);
    const p = await createPlayer(uid, kid(1));
    await updatePlayer(uid, p.id, kid(2, { avatar: "owl", schoolYear: "y3", showOnLeaderboards: true }));
    expect(await getPlayer(uid, p.id)).toMatchObject({ nicknameText: "SunnyOtter2", avatar: "owl", schoolYear: "y3", showOnLeaderboards: true });
    expect(await code(createPlayer(uid, kid(1)))).toBe("ok"); // the old nickname is free again
  });
});

describe("parent PIN", () => {
  it("locks after 5 wrong tries for 15 minutes", async () => {
    const uid = await newUser("pin@example.com");
    await createAccount(uid, consent);
    const t0 = new Date();
    expect(await code(verifyPin(uid, "2468", t0))).toBe("ok");
    for (let i = 0; i < 4; i++) expect(await code(verifyPin(uid, "1111", t0))).toBe("wrong_pin");
    expect(await code(verifyPin(uid, "2468", t0))).toBe("ok"); // a right PIN resets the count
    for (let i = 0; i < 5; i++) await code(verifyPin(uid, "1111", t0));
    expect(await code(verifyPin(uid, "2468", t0))).toBe("pin_locked");
    expect(await code(verifyPin(uid, "2468", new Date(t0.getTime() + 16 * 60_000)))).toBe("ok");
  });
});

describe("creator nickname", () => {
  it("is filtered and unique", async () => {
    const a = await newUser("a@example.com");
    const b = await newUser("b@example.com");
    await createAccount(a, consent);
    await createAccount(b, consent);
    expect(await code(setCreatorNickname(a, "stronzo"))).toBe("blocked_word");
    expect(await code(setCreatorNickname(a, "me@mail.com"))).toBe("invalid");
    expect(await setCreatorNickname(a, "  Pumpkin   Maker ")).toBe("Pumpkin Maker");
    expect(await code(setCreatorNickname(b, "pumpkin maker"))).toBe("nickname_taken");
    await setCreatorNickname(a, "Pumpkin Chef");
    expect(await code(setCreatorNickname(b, "Pumpkin Maker"))).toBe("ok");
  });
});

describe("export and delete", () => {
  it("export holds the account's data and no PIN hash", async () => {
    const uid = await newUser("exp@example.com");
    await createAccount(uid, consent);
    await createPlayer(uid, kid(9));
    const out = await exportAccount(uid);
    const json = JSON.stringify(out);
    expect(json).toContain("exp@example.com");
    expect(json).toContain("SunnyOtter9");
    expect(json).not.toContain("scrypt$");
  });

  it("delete removes the account, profiles, reservations and the sign-in", async () => {
    const uid = await newUser("del@example.com");
    await createAccount(uid, consent);
    await createPlayer(uid, kid(5));
    await setCreatorNickname(uid, "Gone Soon");
    await deleteAccount(uid);
    expect(await getAccount(uid)).toBeNull();
    expect((await db().collection(`accounts/${uid}/players`).get()).size).toBe(0);
    expect((await db().collection("nicknames").where("uid", "==", uid).get()).size).toBe(0);
    expect((await db().collection("creatorNicknames").where("uid", "==", uid).get()).size).toBe(0);
    await expect(adminAuth().getUser(uid)).rejects.toThrow();
  });
});

describe("rate limits", () => {
  it("stop at the limit inside a window and reset in the next one", async () => {
    const t = Date.UTC(2026, 0, 1, 10, 0, 0);
    for (let i = 0; i < 3; i++) expect(await hit("test", "k", 3, 60, t)).toBe(true);
    expect(await hit("test", "k", 3, 60, t + 1000)).toBe(false);
    expect(await hit("test", "other", 3, 60, t)).toBe(true);
    expect(await hit("test", "k", 3, 60, t + 61_000)).toBe(true);
  });
});

describe("email link sign-in", () => {
  it("is generated on the server, points to our own page, and works once", async () => {
    const link = new URL(await createSignInLink("parent@example.com", "/play/school-cup"));
    expect(link.origin + link.pathname).toBe("http://localhost:3000/auth/finish");
    expect(link.searchParams.get("next")).toBe("/play/school-cup");
    const oobCode = link.searchParams.get("oobCode")!;
    expect(oobCode.length).toBeGreaterThan(10);
    const { idToken, uid } = await completeSignIn("parent@example.com", oobCode);
    expect(idToken.length).toBeGreaterThan(20);
    expect((await adminAuth().getUser(uid)).email).toBe("parent@example.com");
    await expect(completeSignIn("parent@example.com", oobCode)).rejects.toThrow("expired_or_used");
  });

  it("does not work for another address", async () => {
    const oobCode = new URL(await createSignInLink("one@example.com", "/")).searchParams.get("oobCode")!;
    await expect(completeSignIn("two@example.com", oobCode)).rejects.toThrow();
  });
});
