import { describe, expect, it } from "vitest";
import { checkCreatorNickname, checkPublicText } from "../../src/lib/moderation";
import { ADJECTIVES, ANIMALS, isNicknameParts, nicknameText, randomNickname } from "../../src/lib/nicknames";
import { signToken, verifyToken } from "../../src/lib/server/signed";

describe("child nicknames", () => {
  it("are built only from the lists", () => {
    expect(isNicknameParts({ adjective: "Sunny", animal: "Otter", number: 42 })).toBe(true);
    expect(nicknameText({ adjective: "Sunny", animal: "Otter", number: 42 })).toBe("SunnyOtter42");
  });
  it.each([
    [{ adjective: "Sunny", animal: "Mario", number: 4 }],
    [{ adjective: "Sophie", animal: "Otter", number: 4 }],
    [{ adjective: "Sunny", animal: "Otter", number: 0 }],
    [{ adjective: "Sunny", animal: "Otter", number: 100 }],
    [{ adjective: "Sunny", animal: "Otter", number: 4.5 }],
    [{ adjective: "Sunny", animal: "Otter" }],
    ["SunnyOtter42"],
    [null],
  ])("refuse anything else: %j", (v) => {
    expect(isNicknameParts(v)).toBe(false);
  });
  it("lists contain no word the filter would block", () => {
    for (const w of [...ADJECTIVES, ...ANIMALS]) expect(checkPublicText(w), w).toEqual({ ok: true });
  });
  it("random nicknames are valid", () => {
    for (let i = 0; i < 200; i++) expect(isNicknameParts(randomNickname())).toBe(true);
  });
});

describe("text filter for creator nicknames", () => {
  it.each(["Mum of Two", "Pumpkin_Maker", "Giulia-82", "Profe Ana"])("accepts %s", (n) => {
    expect(checkCreatorNickname(n).ok).toBe(true);
  });
  it.each([
    ["ab", "length"],
    ["a".repeat(21), "length"],
    ["mario@mail.com", "characters"],
    ["<script>", "characters"],
    ["Sh1t Happens", "blocked_word"],
    ["xxFUCKxx", "blocked_word"],
    ["stronzo", "blocked_word"],
    ["Puta madre", "blocked_word"],
    ["call 333 1234567", "personal_data"],
  ])("refuses %s (%s)", (n, reason) => {
    const r = checkCreatorNickname(n);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe(reason);
  });
  it("refuses links and emails in public text", () => {
    expect(checkPublicText("visit www.example.com").ok).toBe(false);
    expect(checkPublicText("write to me@example.com").ok).toBe(false);
  });
});

describe("signed cookies", () => {
  it("round-trips data for the same purpose", () => {
    const t = signToken("player", { uid: "u1", pid: "p1" }, 60);
    expect(verifyToken("player", t)).toMatchObject({ uid: "u1", pid: "p1" });
  });
  it("cannot be reused for another purpose", () => {
    const t = signToken("player", { uid: "u1" }, 60);
    expect(verifyToken("parent", t)).toBeNull();
  });
  it("rejects a changed body", () => {
    const t = signToken("parent", { uid: "u1" }, 60);
    const [, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ uid: "u2", exp: 9999999999 })).toString("base64url") + "." + sig;
    expect(verifyToken("parent", forged)).toBeNull();
  });
  it("rejects an expired token", () => {
    const t = signToken("parent", { uid: "u1" }, -1);
    expect(verifyToken("parent", t)).toBeNull();
  });
  it("rejects a token signed with another secret", () => {
    const t = signToken("parent", { uid: "u1" }, 60, "another-secret-another-secret-another-secret");
    expect(verifyToken("parent", t)).toBeNull();
  });
});
