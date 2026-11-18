import { checkGameHtml } from "@zukka/engines";
import { describe, expect, it } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { anthropicApiKey } from "../../src/lib/server/ai-budget";
import { applyEdits, explainAiError, extractHtml, GameAiError } from "../../src/lib/server/ai-games";
import { fakeEdit, fakeGame } from "../../src/lib/server/fake-ai";
import { FreeBrief } from "../../src/lib/server/free-games";

const brief = (over: Record<string, unknown> = {}) => ({
  title: "Star Catcher",
  gameType: "catch",
  description: "Stars fall from the sky; catch the star with the right answer to fill the rocket.",
  subject: "maths",
  year: "2",
  topics: ["facts-20"],
  otherTopics: "",
  questionStyle: "choice",
  setting: "space",
  settingOther: "",
  hero: "A little rocket called Zoom",
  others: "",
  mood: "bright",
  winBy: "collect",
  levels: "4",
  minutes: "7",
  reward: "stars",
  extra: "",
  ...over,
});

describe("free creation brief", () => {
  it("accepts complete answers", () => {
    expect(FreeBrief.safeParse(brief()).success).toBe(true);
    expect(FreeBrief.safeParse(brief({ subject: "other", topics: [], otherTopics: "The planets" })).success).toBe(true);
  });
  it.each([
    ["a short description", { description: "a game" }],
    ["an unknown kind of game", { gameType: "shooter" }],
    ["no topic", { topics: [], otherTopics: "" }],
    ["'other' subject without saying what", { subject: "other", topics: [], otherTopics: "" }],
    ["a topic from another subject", { topics: ["W2-0"] }],
    ["'other' place without a description", { setting: "other", settingOther: "" }],
    ["11 levels", { levels: "11" }],
    ["8 minutes", { minutes: "8" }],
    ["a bad title", { title: "<b>x</b>" }],
  ])("refuses %s", (_n, over) => {
    expect(FreeBrief.safeParse(brief(over)).success).toBe(false);
  });
});

describe("AI output handling", () => {
  it("takes the HTML document out of the text around it", () => {
    expect(extractHtml("Here you are:\n```html\n<!DOCTYPE html><html><body>x</body></html>\n```")).toBe("<!DOCTYPE html><html><body>x</body></html>");
    expect(extractHtml("no game here")).toBeNull();
  });
  it("applies edits only when each one matches exactly once", () => {
    const html = "<p>a</p><p>b</p><p>a</p>";
    expect(applyEdits(html, [{ find: "<p>b</p>", replace: "<p>B</p>" }])).toBe("<p>a</p><p>B</p><p>a</p>");
    expect(applyEdits(html, [{ find: "<p>a</p>", replace: "x" }])).toBeNull(); // twice
    expect(applyEdits(html, [{ find: "<p>c</p>", replace: "x" }])).toBeNull(); // missing
    expect(applyEdits(html, [{ find: "", replace: "x" }])).toBeNull();
  });
  it("the stand-in game used in tests follows the rules", () => {
    expect(checkGameHtml(fakeGame("Test <Game>"))).toEqual([]);
    expect(fakeEdit(fakeGame("Moon Cup"), "make it red please")).toContain("Moon Cup · make it red please");
  });
});

describe("errors from the AI service", () => {
  const api = (status: number, type: string, message: string) =>
    Anthropic.APIError.generate(status, { type: "error", error: { type, message } }, message, new Headers());
  it.each([
    [api(400, "invalid_request_error", "Your credit balance is too low to access the Anthropic API."), /run out of credit/],
    [api(401, "authentication_error", "invalid x-api-key"), /key was refused/],
    [api(529, "overloaded_error", "Overloaded"), /very busy/],
    [api(429, "rate_limit_error", "Too many requests"), /very busy/],
    [api(400, "invalid_request_error", "something else"), /refused the request/],
    [new Anthropic.APIConnectionTimeoutError(), /took too long/],
    [new Anthropic.APIConnectionError({ message: "fetch failed" }), /could not reach/],
  ])("explains %s to the parent and keeps the reason", (e, expected) => {
    const out = explainAiError(e);
    expect(out).toBeInstanceOf(GameAiError);
    expect((out as GameAiError).message).toMatch(expected);
    expect((out as GameAiError).detail).toBeTruthy();
  });
  it("leaves other errors alone", () => {
    const e = new Error("x");
    expect(explainAiError(e)).toBe(e);
  });
});

describe("the API key", () => {
  it.each([["sk-ant-x\n"], ["  sk-ant-x "], ['"sk-ant-x"'], ["'sk-ant-x'"]])("ignores what was pasted around it: %j", (raw) => {
    const before = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = raw;
    expect(anthropicApiKey()).toBe("sk-ant-x");
    process.env.ANTHROPIC_API_KEY = "  ";
    expect(anthropicApiKey()).toBeUndefined();
    if (before === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = before;
  });
});
