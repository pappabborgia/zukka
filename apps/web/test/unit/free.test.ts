import { checkGameHtml } from "@zukka/engines";
import { describe, expect, it } from "vitest";
import { applyEdits, extractHtml } from "../../src/lib/server/ai-games";
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
