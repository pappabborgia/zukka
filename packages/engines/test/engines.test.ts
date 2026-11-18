import { readFileSync } from "node:fs";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  assertGameSize,
  buildQuickConfig,
  extractConfig,
  GameTooLargeError,
  injectConfig,
  MAX_GAME_BYTES,
  Q_GENERATORS,
  SchoolCupConfig,
  SchoolCupQuickForm,
  scriptSafeJson,
  StarfishRaceConfig,
  T_GENERATORS,
  topicsFor,
} from "../src";

const SC = readFileSync(new URL("../../../engines/school-cup/template.html", import.meta.url), "utf8");
const SR = readFileSync(new URL("../../../engines/starfish-race/template.html", import.meta.url), "utf8");
const base = SchoolCupConfig.parse(extractConfig(SC));

const form = (over: Record<string, unknown> = {}) => ({
  title: "Lily's Super Cup",
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

describe("default configurations", () => {
  it("School Cup's current game is a valid configuration", () => {
    expect(base.subjects.map((s) => s.id)).toEqual(["maths", "reading", "writing", "phonics", "mix"]);
    expect(base.teams.home.name).toBe("Zukka FC");
    expect(base.tournaments).toHaveLength(5);
  });
  it("Race to Starfish Bay's current game is a valid configuration", () => {
    const c = StarfishRaceConfig.parse(extractConfig(SR));
    expect(c.towns).toHaveLength(8);
  });
  it("the schema knows exactly the generators the template has", () => {
    const qBlock = SC.slice(SC.indexOf("const Q = {"), SC.indexOf("READING AND WRITING"));
    const q = [...qBlock.matchAll(/^ {2}([a-zA-Z0-9]+)\(/gm)].map((m) => m[1]).sort();
    expect(q).toEqual([...Q_GENERATORS].sort());
    const tBlock = SC.slice(SC.indexOf("const T = {"), SC.indexOf("const HOMO2"));
    const t = [...tBlock.matchAll(/^ {2}([a-zA-Z0-9]+):/gm)].map((m) => m[1]).sort();
    expect(t).toEqual([...T_GENERATORS].sort());
  });
});

describe("config block", () => {
  it("injects and extracts the same configuration", () => {
    const html = injectConfig(SC, base);
    expect(extractConfig(html)).toEqual(base);
  });
  it("cannot close the script tag", () => {
    const out = scriptSafeJson({ x: "</script><script>alert(1)</script>", y: " " });
    expect(out).not.toContain("</");
    expect(out).not.toContain("<script");
    expect(JSON.parse(out)).toEqual({ x: "</script><script>alert(1)</script>", y: " " });
  });
  it("refuses games over the size limit with a clear error", () => {
    expect(assertGameSize("x".repeat(1000))).toBe(1000);
    expect(() => assertGameSize("x".repeat(MAX_GAME_BYTES + 1))).toThrow(GameTooLargeError);
    expect(() => assertGameSize("x".repeat(MAX_GAME_BYTES + 1))).toThrow(/limit is 700 KB/);
  });
});

describe("schema rejects unsafe or broken configurations", () => {
  const bad = (patch: (c: ReturnType<typeof structuredClone<typeof base>>) => void) => {
    const c = structuredClone(base);
    patch(c);
    return SchoolCupConfig.safeParse(c).success;
  };
  it.each([
    ["markup in a team name", (c: typeof base) => void (c.teams.home.name = "<img src=x onerror=alert(1)>")],
    ["CSS in a colour", (c: typeof base) => void (c.teams.home.c1 = "red;background:url(https://x)")],
    ["an unknown generator", (c: typeof base) => void ((c.subjects[0] as { years: { "2": { gens: unknown[] }[] } }).years["2"][0].gens = [{ q: "fetchSomething" }])],
    ["a script in a question", (c: typeof base) => void (c.bank.R2![0][0].q = "What is </script>?")],
    ["extra fields", (c: typeof base) => void ((c as Record<string, unknown>).html = "<p>hi</p>")],
    ["a missing bank", (c: typeof base) => void delete c.bank.R2],
  ])("%s", (_name, patch) => {
    expect(bad(patch)).toBe(false);
  });
});

describe("quick creation form", () => {
  it("accepts a normal form", () => {
    expect(SchoolCupQuickForm.safeParse(form()).success).toBe(true);
  });
  it.each([
    ["a topic from another subject", { topics: ["W2-0"] }],
    ["a topic from another year", { topics: ["facts-10"] }],
    ["times tables without tables", { tables: [] }],
    ["a table out of range", { tables: [13] }],
    ["the same two colours", { colour2: "#7048e8" }],
    ["markup in the title", { title: "<b>Cup</b>" }],
    ["a too long team name", { teamName: "x".repeat(25) }],
    ["no topics", { topics: [] }],
    ["seven topics", { topics: ["times-tables", "borrowing", "division", "fractions", "money", "time", "measures"] }],
  ])("refuses %s", (_name, over) => {
    expect(SchoolCupQuickForm.safeParse(form(over)).success).toBe(false);
  });

  it("builds a valid configuration from every topic of every subject and year", () => {
    for (const subject of ["maths", "reading", "writing"] as const)
      for (const year of [2, 3] as const)
        for (const t of topicsFor(subject, year)) {
          const c = buildQuickConfig(base, form({ subject, year, topics: [t.id], tables: t.usesTables ? [3, 4] : [] }));
          expect(c.subjects).toHaveLength(1);
          expect(c.years).toEqual([expect.objectContaining({ id: year })]);
        }
  });

  it("puts the parent's choices into the game and keeps only what it needs", () => {
    const c = buildQuickConfig(base, form());
    expect(c.title).toBe("Lily's Super Cup");
    expect(c.teams.home).toMatchObject({ name: "Purple Pandas", c1: "#7048e8", c2: "#ffd43b", pattern: "stripes", initials: "PP" });
    expect(c.tournaments).toEqual([expect.objectContaining({ name: "Rainbow Trophy" })]);
    expect(c.bank).toEqual({});
    const stages = (c.subjects[0] as { years: Record<string, { gens: { q?: string; a?: unknown[] }[] }[]> }).years["3"];
    expect(stages).toHaveLength(6);
    expect(stages[0].gens).toContainEqual({ q: "times", a: [[6, 7], 5] });
    expect(stages[5].gens).toContainEqual({ q: "times", a: [[6, 7], 12] }); // harder in the final
    expect(JSON.stringify(c).length).toBeLessThan(20_000);
  });
});

describe("quick games really play", () => {
  let browser: Browser;
  beforeAll(async () => {
    browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
  });
  afterAll(async () => {
    await browser.close();
  });

  it("every topic makes valid questions in every round", async () => {
    const errors: string[] = [];
    for (const subject of ["maths", "reading", "writing"] as const)
      for (const year of [2, 3] as const) {
        const topics = topicsFor(subject, year).map((t) => t.id);
        // all topics, a few at a time (the form allows up to 6)
        for (let i = 0; i < topics.length; i += 6) {
          const pickTopics = topics.slice(i, i + 6);
          const c = buildQuickConfig(base, form({ subject, year, topics: pickTopics, tables: [2, 6, 7, 12] }));
          const page = await browser.newPage(); // a fresh page for each game
          page.on("pageerror", (e) => errors.push(e.message));
          await page.setContent(injectConfig(SC, c));
          const problems = await page.evaluate(() => {
            const w = window as unknown as { makeQuestion: (l: number) => { text: string; answer: unknown; type?: string; labels: string[]; answerLabel: string } };
            const out: string[] = [];
            for (let l = 1; l <= 6; l++)
              for (let k = 0; k < 25; k++) {
                const q = w.makeQuestion(l);
                if (!q.text || q.answer === undefined) out.push(`L${l} empty`);
                else if (!q.type && !q.labels.includes(q.answerLabel)) out.push(`L${l} answer not in options: ${q.text}`);
              }
            return out;
          });
          expect(problems, `${subject} Y${year} ${pickTopics.join(",")}`).toEqual([]);
          const shown = await page.evaluate(() => ({ title: document.title, years: document.querySelectorAll("#yearSeg button").length }));
          expect(shown).toEqual({ title: "Lily's Super Cup", years: 1 });
          await page.close();
        }
      }
    expect(errors).toEqual([]);
  }, 120_000);
});

describe("static check of game HTML", () => {
  const ok = (body: string) => `<!DOCTYPE html><html><head><title>t</title></head><body><script>
const Zukka = { s: () => parent.postMessage({protocol:'zukka/1', event:'game_started'}, '*') };
// events: 'game_started' 'answer' 'game_completed'
${body}
</script></body></html>`;
  it("passes our own games", async () => {
    const { checkGameHtml } = await import("../src");
    expect(checkGameHtml(SC).filter((p) => p.severity === "blocking")).toEqual([]);
    expect(checkGameHtml(SR)).toEqual([]);
    expect(checkGameHtml(ok("let x = 1;"))).toEqual([]);
  });
  it.each([
    ["fetch('/x')", "network_fetch"],
    ["new XMLHttpRequest()", "network_xhr"],
    ["new WebSocket('wss://a')", "network_websocket"],
    ["navigator.sendBeacon('/a')", "network_beacon"],
    ["new RTCPeerConnection()", "network_webrtc"],
    ["import('x')", "dynamic_import"],
    ["eval('1')", "eval"],
    ["setTimeout('alert(1)', 10)", "eval"],
    ["localStorage.setItem('a','b')", "storage"],
    ["document.cookie", "storage"],
    ["window.open('x')", "popup"],
    ["top.location = 'x'", "navigation"],
    ["parent.document.body", "parent_access"],
    ["new Worker('w.js')", "workers"],
    ["navigator.mediaDevices.getUserMedia({})", "device_access"],
    ["const img = 'https://example.com/a.png'", "web_address"],
  ])("finds %s", async (code, expected) => {
    const { checkGameHtml } = await import("../src");
    expect(checkGameHtml(ok(code)).map((p) => p.code)).toContain(expected);
  });
  it("finds external resources, links, forms and missing events", async () => {
    const { checkGameHtml } = await import("../src");
    const codes = checkGameHtml(`<!DOCTYPE html><html><head><link rel="stylesheet" href="https://cdn.example.com/a.css"></head>
<body><a href="https://example.com">x</a><form></form><img src="//example.com/a.png"></body></html>`).map((p) => p.code);
    expect(codes).toEqual(expect.arrayContaining(["external_resource", "external_link", "form", "no_events", "missing_game_started"]));
    expect(checkGameHtml("hello").map((p) => p.code)).toContain("not_a_document");
  });
  it("allows the SVG namespace address", async () => {
    const { checkGameHtml } = await import("../src");
    expect(checkGameHtml(ok("document.createElementNS('http://www.w3.org/2000/svg','svg')"))).toEqual([]);
  });
});
