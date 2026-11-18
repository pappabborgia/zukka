import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createAccount } from "../../src/lib/server/accounts";
import { adminAuth, db } from "../../src/lib/server/firebase";
import { builtinStartHtml, createFreeGame, createRemix, requestChange, runChange, runCreate } from "../../src/lib/server/free-games";
import { getMyGame, listVersions, StudioError } from "../../src/lib/server/games";
import { STUDIO_LIMITS } from "../../src/lib/config/studio";

const PROJECT = "demo-zukka";
const consent = { adult: true, childProfiles: true, policies: true, pin: "2468" };
const brief = (over: Record<string, unknown> = {}) => ({
  title: "Star Catcher",
  gameType: "catch",
  description: "Stars fall from the sky; catch the star with the right answer to fill the rocket.",
  subject: "maths",
  year: "2",
  topics: ["facts-20"],
  questionStyle: "choice",
  setting: "space",
  hero: "A little rocket called Zoom",
  mood: "bright",
  winBy: "collect",
  levels: "4",
  minutes: "7",
  reward: "stars",
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
    return e instanceof StudioError ? e.code : (e as { code?: string }).code ?? String(e);
  }
}

beforeAll(() => {
  process.env.ZUKKA_FAKE_AI = "1"; // the stand-in AI: no API calls in tests
});
afterAll(() => {
  delete process.env.ZUKKA_FAKE_AI;
});
beforeEach(async () => {
  await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: "DELETE" });
  await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${PROJECT}/accounts`, { method: "DELETE" });
});

describe("free games", () => {
  it("are created from the wizard, then written by the AI as version 1", async () => {
    const uid = await parent("free@example.com");
    const { gameId } = await createFreeGame(uid, brief());
    let g = await getMyGame(uid, gameId);
    expect(g).toMatchObject({ kind: "free", status: "draft", currentVersionId: null, versionCount: 0, title: "Star Catcher" });
    expect(g?.generation).toMatchObject({ state: "running", kind: "create" });
    const stored = JSON.parse((await db().doc(`games/${gameId}`).get()).get("brief"));
    expect(stored).toMatchObject({ gameType: "catch", setting: "space", levels: 4, minutes: 7 });

    await runCreate(gameId);
    g = await getMyGame(uid, gameId);
    expect(g?.generation?.state).toBe("done");
    expect(g?.versionCount).toBe(1);
    const [v1] = await listVersions(uid, gameId);
    expect(v1).toMatchObject({ n: 1, kind: "html", problems: [] });
    expect((await db().doc(`games/${gameId}/versions/${v1.id}`).get()).get("html")).toContain("Star Catcher");
  });

  it("refuse incomplete or unsuitable answers", async () => {
    const uid = await parent("bad@example.com");
    expect(await code(createFreeGame(uid, brief({ description: "short" })))).toBe("invalid");
    expect(await code(createFreeGame(uid, brief({ hero: "Pikachu and his friends" })))).toBe("protected_name");
    expect(await code(createFreeGame(uid, brief({ extra: "send results to me@mail.com" })))).toBe("personal_data");
  });

  it("change: a new version, one at a time, only by the owner", async () => {
    const a = await parent("a@example.com");
    const b = await parent("b@example.com");
    const { gameId } = await createFreeGame(a, brief());
    expect(await code(requestChange(a, gameId, "make it red"))).toBe("busy"); // still being written
    await runCreate(gameId);
    expect(await code(requestChange(b, gameId, "make it red"))).toBe("not_found");
    const request = await requestChange(a, gameId, "make the rocket red");
    expect(await code(requestChange(a, gameId, "and blue"))).toBe("busy");
    await runChange(gameId, request);
    const g = await getMyGame(a, gameId);
    expect(g).toMatchObject({ versionCount: 2, generation: { state: "done", request: "make the rocket red" } });
    const versions = await listVersions(a, gameId);
    expect(versions[0].note).toContain("make the rocket red");
    expect((await db().doc(`games/${gameId}/versions/${versions[0].id}`).get()).get("html")).toContain("make the rocket red");
  });

  it("count AI uses per game", async () => {
    const uid = await parent("count@example.com");
    const { gameId } = await createFreeGame(uid, brief());
    await runCreate(gameId);
    await db().doc(`games/${gameId}`).update({ aiGenerations: STUDIO_LIMITS.aiGenerationsPerGame });
    expect(await code(requestChange(uid, gameId, "make it harder"))).toBe("per_game");
  });

  it("a remix starts as a copy of the catalogue game, with no AI", async () => {
    const uid = await parent("remix@example.com");
    const html = builtinStartHtml("starfish-race")!;
    expect(html).toContain("Race to Starfish Bay");
    const { gameId } = await createRemix(uid, "My Starfish Race", { id: "starfish-race", title: "Race to Starfish Bay", subjects: ["maths"], years: [2, 3], html });
    const g = await getMyGame(uid, gameId);
    expect(g).toMatchObject({ kind: "free", parentGameId: "starfish-race", versionCount: 1, generation: null });
    const [v1] = await listVersions(uid, gameId);
    expect(v1).toMatchObject({ note: "Copied from the original game", problems: [] });
    expect(await code(createRemix(uid, "<x>", { id: "starfish-race", title: "x", subjects: [], years: [], html }))).toBe("invalid");
  });

  it("a lost generation shows as failed after the time limit", async () => {
    const uid = await parent("lost@example.com");
    const { gameId } = await createFreeGame(uid, brief());
    await db().doc(`games/${gameId}`).update({ "generation.startedAt": new Date(Date.now() - 10 * 60_000) });
    const g = await getMyGame(uid, gameId);
    expect(g?.generation).toMatchObject({ state: "failed" });
    expect(g?.generation?.message).toContain("took too long");
  });
});
