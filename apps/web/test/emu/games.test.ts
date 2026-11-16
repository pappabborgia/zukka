import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  addQuickVersion,
  createQuickGame,
  deleteDraft,
  getMyGame,
  listMyGames,
  listVersions,
  quickGameBytes,
  restoreVersion,
  StudioError,
} from "../../src/lib/server/games";
import { createAccount, deleteAccount, exportAccount } from "../../src/lib/server/accounts";
import { adminAuth, db } from "../../src/lib/server/firebase";
import { STUDIO_LIMITS } from "../../src/lib/config/studio";

const PROJECT = "demo-zukka";
const consent = { adult: true, childProfiles: true, policies: true, pin: "2468" };
const form = (over: Record<string, unknown> = {}) => ({
  title: "Lily Super Cup",
  tournamentName: "Rainbow Trophy",
  teamName: "Purple Pandas",
  colour1: "#7048e8",
  colour2: "#ffd43b",
  pattern: "stripes",
  subject: "maths",
  year: 3,
  topics: ["times-tables", "borrowing"],
  tables: [6, 7],
  ...over,
});

async function parent(email: string) {
  const uid = (await adminAuth().createUser({ email })).uid;
  await createAccount(uid, consent);
  return uid;
}
async function code(p: Promise<unknown>) {
  try {
    await p;
    return "ok";
  } catch (e) {
    return e instanceof StudioError ? e.code : String(e);
  }
}

beforeEach(async () => {
  await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: "DELETE" });
  await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${PROJECT}/accounts`, { method: "DELETE" });
});
afterAll(() => {});

describe("quick games", () => {
  it("are created as drafts with a first version holding the config", async () => {
    const uid = await parent("a@example.com");
    const { gameId, versionId } = await createQuickGame(uid, "school-cup", form());
    const g = await getMyGame(uid, gameId);
    expect(g).toMatchObject({ title: "Lily Super Cup", kind: "quick", engine: "school-cup", status: "draft", currentVersionId: versionId, versionCount: 1 });
    expect(g?.quickForm?.tables).toEqual([6, 7]);
    const v = (await db().doc(`games/${gameId}/versions/${versionId}`).get()).data()!;
    const cfg = JSON.parse(v.configJson);
    expect(cfg.teams.home.name).toBe("Purple Pandas");
    expect(v.bytes).toBe(quickGameBytes("school-cup", v.configJson));
    expect(v.bytes).toBeLessThan(700 * 1024);
  });

  it("refuse bad forms, rude words and real teams", async () => {
    const uid = await parent("b@example.com");
    expect(await code(createQuickGame(uid, "school-cup", form({ topics: [] })))).toBe("invalid");
    expect(await code(createQuickGame(uid, "school-cup", form({ teamName: "Stronzo FC" })))).toBe("blocked_word");
    expect(await code(createQuickGame(uid, "school-cup", form({ teamName: "Real Madrid" })))).toBe("protected_name");
    expect(await code(createQuickGame(uid, "school-cup", form({ title: "Pikachu Cup" })))).toBe("protected_name");
    expect(await code(createQuickGame(uid, "starfish-race", form()))).toBe("invalid");
    expect(await code(createQuickGame(uid, "school-cup", form({ title: "<script>" })))).toBe("invalid");
  });

  it("are limited to 5 drafts per account", async () => {
    const uid = await parent("c@example.com");
    for (let i = 0; i < STUDIO_LIMITS.maxDrafts; i++) await createQuickGame(uid, "school-cup", form({ title: `Cup number ${i}` }));
    expect(await code(createQuickGame(uid, "school-cup", form()))).toBe("too_many_drafts");
    const other = await parent("d@example.com");
    expect(await code(createQuickGame(other, "school-cup", form()))).toBe("ok");
  });

  it("belong to their creator only", async () => {
    const a = await parent("a@example.com");
    const b = await parent("b@example.com");
    const { gameId, versionId } = await createQuickGame(a, "school-cup", form());
    expect(await getMyGame(b, gameId)).toBeNull();
    expect(await listMyGames(b)).toEqual([]);
    expect(await code(addQuickVersion(b, gameId, form({ title: "Taken over" })))).toBe("not_found");
    expect(await code(restoreVersion(b, gameId, versionId))).toBe("not_found");
    expect(await code(deleteDraft(b, gameId))).toBe("not_found");
    expect(await code(listVersions(b, gameId))).toBe("not_found");
    expect((await getMyGame(a, gameId))?.title).toBe("Lily Super Cup");
  });

  it("keep every version, and can go back to one", async () => {
    const uid = await parent("v@example.com");
    const { gameId, versionId: v1 } = await createQuickGame(uid, "school-cup", form());
    const v2 = await addQuickVersion(uid, gameId, form({ title: "Lily Mega Cup", subject: "writing", year: 2, topics: ["W2-0", "W2-1"], tables: [] }));
    let g = await getMyGame(uid, gameId);
    expect(g).toMatchObject({ title: "Lily Mega Cup", subject: "writing", year: 2, currentVersionId: v2, versionCount: 2 });
    expect((await listVersions(uid, gameId)).map((v) => v.n)).toEqual([2, 1]);
    await restoreVersion(uid, gameId, v1);
    g = await getMyGame(uid, gameId);
    expect(g).toMatchObject({ currentVersionId: v1, title: "Lily Super Cup" });
    // the old version itself never changed
    const first = JSON.parse((await db().doc(`games/${gameId}/versions/${v1}`).get()).get("configJson"));
    expect(first.title).toBe("Lily Super Cup");
  });

  it("cannot be changed once sent for review", async () => {
    const uid = await parent("r@example.com");
    const { gameId, versionId } = await createQuickGame(uid, "school-cup", form());
    await db().doc(`games/${gameId}`).update({ status: "submitted" });
    expect(await code(addQuickVersion(uid, gameId, form({ title: "Sneaky change" })))).toBe("not_editable");
    expect(await code(restoreVersion(uid, gameId, versionId))).toBe("not_editable");
    expect(await code(deleteDraft(uid, gameId))).toBe("not_editable");
  });

  it("are deleted with their versions, and with the account", async () => {
    const uid = await parent("del@example.com");
    const { gameId } = await createQuickGame(uid, "school-cup", form());
    await deleteDraft(uid, gameId);
    expect((await db().collection(`games/${gameId}/versions`).get()).size).toBe(0);
    expect((await db().doc(`games/${gameId}`).get()).exists).toBe(false);

    const { gameId: g2 } = await createQuickGame(uid, "school-cup", form());
    expect(JSON.stringify(await exportAccount(uid))).toContain("Lily Super Cup");
    await deleteAccount(uid);
    expect((await db().doc(`games/${g2}`).get()).exists).toBe(false);
  });
});

describe("AI limits and budget", () => {
  it("allow 10 generations per account per day, per game, and stop at the monthly budget", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key-not-used";
    const { reserveGeneration, recordUsage, AiLimitError } = await import("../../src/lib/server/ai-budget");
    const ai = async (p: Promise<unknown>) => {
      try {
        await p;
        return "ok";
      } catch (e) {
        return e instanceof AiLimitError ? e.code : String(e);
      }
    };
    const uid = await parent("ai@example.com");
    const day1 = new Date("2026-03-02T10:00:00Z");
    for (let i = 0; i < STUDIO_LIMITS.aiGenerationsPerAccountPerDay; i++) expect(await ai(reserveGeneration(uid, null, day1))).toBe("ok");
    expect(await ai(reserveGeneration(uid, null, day1))).toBe("per_day");
    expect(await ai(reserveGeneration(uid, null, new Date("2026-03-03T10:00:00Z")))).toBe("ok"); // a new day

    const { gameId } = await createQuickGame(uid, "school-cup", form());
    await db().doc(`games/${gameId}`).update({ aiGenerations: STUDIO_LIMITS.aiGenerationsPerGame });
    expect(await ai(reserveGeneration(uid, gameId, new Date("2026-03-04T10:00:00Z")))).toBe("per_game");

    // spend: 1M output tokens = $20, which is the default budget
    const april = new Date("2026-04-01T10:00:00Z");
    await recordUsage({ input_tokens: 0, output_tokens: 1_000_000 }, april);
    const m = (await db().doc("aiMonthly/2026-04").get()).data()!;
    expect(m.usd).toBeCloseTo(20);
    expect(m.alertSent).toBe(true);
    expect(await ai(reserveGeneration(uid, null, april))).toBe("budget");

    delete process.env.ANTHROPIC_API_KEY;
    expect(await ai(reserveGeneration(uid, null, new Date("2026-05-01T10:00:00Z")))).toBe("not_configured");
  });
});
