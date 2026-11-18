import { readFileSync } from "node:fs";
import { buildQuickConfig, extractConfig, SchoolCupConfig } from "@zukka/engines";
import { describe, expect, it, vi } from "vitest";
import { compute, verifyItems, verifyWordProblems } from "../../src/lib/ai-check";

describe("maths answers are computed by code", () => {
  it.each([
    [7, "+", 5, 12],
    [12, "-", 5, 7],
    [6, "×", 7, 42],
    [42, "÷", 6, 7],
    [3, "-", 5, null],
    [7, "÷", 2, null],
    [7, "÷", 0, null],
    [2.5, "+", 1, null],
  ])("%s %s %s = %s", (a, op, b, r) => {
    expect(compute(a as number, op as string, b as number)).toBe(r);
  });

  it("throws away problems where the AI's answer is wrong", () => {
    const ok = verifyWordProblems(
      [
        { text: "Mia has 6 bags with 7 apples in each. How many apples?", a: 6, op: "×", b: 7, answer: 42 },
        { text: "Sam has 6 boxes with 7 pens in each. How many pens?", a: 6, op: "×", b: 7, answer: 43 }, // wrong
        { text: "There are 8 rows of 6 chairs. How many chairs?", a: 8, op: "×", b: 6, answer: 48 },
      ],
      { ops: ["×"], max: 144, tables: [6, 7] },
    );
    expect(ok.map((p) => p.answer)).toEqual([42, 48]);
    expect(ok[0].near).not.toContain(42);
  });

  it("throws away problems with the wrong operation, missing numbers, other tables or bad words", () => {
    const ok = verifyWordProblems(
      [
        { text: "Ben has 9 sweets and eats 4. How many are left?", a: 9, op: "-", b: 4, answer: 5 }, // op not allowed here
        { text: "Ava has some boxes with 7 pens each. How many pens?", a: 3, op: "×", b: 7, answer: 21 }, // 3 not in text
        { text: "There are 3 rows of 4 cars. How many cars?", a: 3, op: "×", b: 4, answer: 12 }, // not the 6 or 7 table
        { text: "Visit www.shop.com: 6 bags of 7 sweets. How many?", a: 6, op: "×", b: 7, answer: 42 }, // link
        { text: "Zara has 7 packs of 6 stickers. How many stickers?", a: 7, op: "×", b: 6, answer: 42 },
      ],
      { ops: ["×"], max: 144, tables: [6, 7] },
    );
    expect(ok.map((p) => p.text)).toEqual(["Zara has 7 packs of 6 stickers. How many stickers?"]);
  });

  it("refuses negative results and remainders", () => {
    expect(verifyWordProblems([{ text: "Tom has 3 cards and gives away 5.", a: 3, op: "-", b: 5, answer: -2 }], { ops: ["-"], max: 100 })).toEqual([]);
    expect(verifyWordProblems([{ text: "Share 7 cakes between 2 friends.", a: 7, op: "÷", b: 2, answer: 3 }], { ops: ["÷"], max: 100 })).toEqual([]);
  });
});

describe("multiple-choice items from the AI", () => {
  it("keeps only clean, well-formed items", () => {
    const items = verifyItems([
      { question: "Which word rhymes with cat?", correct: "hat", wrong: ["cot", "cup", "can"], passage: null },
      { question: "Which word rhymes with dog?", correct: "log", wrong: ["log", "dig", "dot"], passage: null }, // duplicate answers
      { question: "Which is a fruit?", correct: "apple", wrong: ["car", "hat"], passage: null }, // only two wrong
      { question: "Who is <b>Mario</b>?", correct: "a plumber", wrong: ["a cat", "a car", "a dog"], passage: null }, // markup
      { question: "Which team is from Spain?", correct: "Real Madrid", wrong: ["a", "b", "c"], passage: null }, // real club
      { question: "Why did Mia smile?", correct: "She found her kite", wrong: ["It rained", "She was cold", "She lost her hat"], passage: "Mia looked under the bed and found her red kite. She smiled." },
      { question: "Which word rhymes with cat?", correct: "hat", wrong: ["cot", "cup", "can"], passage: null }, // repeated
    ]);
    expect(items.map((i) => i.q)).toEqual(["Which word rhymes with cat?", "Why did Mia smile?"]);
    expect(items[1].p).toContain("red kite");
  });
});

describe("AI questions end up in a game that works", () => {
  it("with a mocked model: wrong maths is dropped, the rest is stored and valid", async () => {
    vi.resetModules();
    vi.doMock("../../src/lib/server/ai-budget", () => ({ recordUsage: vi.fn(async () => {}), anthropicApiKey: () => "test-key" }));
    vi.doMock("@anthropic-ai/sdk", () => {
      class APIError extends Error {
        status = 0;
      }
      class Anthropic {
        static APIError = APIError;
        beta = {
          messages: {
            parse: vi.fn(async (params: { messages: { content: string }[] }) => {
              const prompt = params.messages[0].content;
              const parsed_output = prompt.includes("word problems")
                ? {
                    problems: [
                      { text: "Mia has 6 bags with 7 apples in each. How many apples?", a: 6, op: "×", b: 7, answer: 42 },
                      { text: "There are 7 rows of 7 chairs. How many chairs?", a: 7, op: "×", b: 7, answer: 49 },
                      { text: "Ben has 6 boxes of 6 pens. How many pens?", a: 6, op: "×", b: 6, answer: 36 },
                      { text: "Ava has 7 jars of 6 sweets. How many sweets?", a: 7, op: "×", b: 6, answer: 41 }, // wrong, dropped
                    ],
                  }
                : { items: [] };
              return { parsed_output, stop_reason: "end_turn", usage: { input_tokens: 500, output_tokens: 900 } };
            }),
          },
        };
      }
      return { default: Anthropic };
    });
    const { generateExtras } = await import("../../src/lib/server/ai-questions");
    const form = {
      title: "Owl Cup",
      tournamentName: "Rainbow Trophy",
      teamName: "Green Owls",
      colour1: "#2f9e44",
      colour2: "#ffffff",
      pattern: "hoops" as const,
      subject: "maths" as const,
      year: 3 as const,
      topics: ["times-tables", "fractions"],
      tables: [6, 7],
    };
    const { extra, added } = await generateExtras(form);
    expect(added).toBe(3);
    expect(extra.asks?.["times-tables"]?.map((a) => a.answer)).toEqual([42, 49, 36]);
    expect(extra.asks?.fractions).toBeUndefined(); // no word problems for fractions
    const base = SchoolCupConfig.parse(extractConfig(readFileSync(new URL("../../../../engines/school-cup/template.html", import.meta.url), "utf8")));
    const config = buildQuickConfig(base, form, extra);
    const stages = (config.subjects[0] as { years: Record<string, { gens: unknown[] }[]> }).years["3"];
    expect(stages[0].gens).toContainEqual({ asks: extra.asks!["times-tables"] });
  });
});
