import { AskItem, BankItem } from "@zukka/engines";
import { checkProtectedNames, checkPublicText } from "./moderation";

/**
 * Checks on what the AI writes, before anything is saved. Pure functions, unit tested.
 * Maths answers are always computed here: the AI's own answer is only used to throw away
 * problems where it disagrees with the code.
 */
export type Op = "+" | "-" | "×" | "÷";

export interface AiWordProblem {
  text: string;
  a: number;
  op: string;
  b: number;
  answer: number;
}

export interface AiItem {
  question: string;
  correct: string;
  wrong: string[];
  passage?: string | null;
}

export function compute(a: number, op: string, b: number): number | null {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return null;
  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a - b >= 0 ? a - b : null;
    case "×":
    case "x":
    case "*":
      return a * b;
    case "÷":
    case "/":
      return b > 0 && a % b === 0 ? a / b : null;
    default:
      return null;
  }
}

const mentions = (text: string, n: number) => new RegExp(`(^|[^0-9])${n}([^0-9]|$)`).test(text.replace(/,(?=\d{3})/g, ""));

/** Keeps only word problems whose answer the code confirms, with numbers in range and clean text. */
export function verifyWordProblems(
  raw: AiWordProblem[],
  opts: { ops: Op[]; max: number; tables?: number[] },
): { text: string; answer: number; near: number[] }[] {
  const out: { text: string; answer: number; near: number[] }[] = [];
  const seen = new Set<string>();
  for (const p of raw) {
    const op = p.op === "x" || p.op === "*" ? "×" : p.op === "/" ? "÷" : p.op;
    if (!opts.ops.includes(op as Op)) continue;
    const answer = compute(p.a, op, p.b);
    if (answer === null || answer !== p.answer) continue; // the AI got it wrong, or the sum is not valid
    if (p.a > opts.max || p.b > opts.max || answer > opts.max * (op === "×" ? 12 : 1)) continue;
    if (opts.tables?.length && op === "×" && !opts.tables.includes(p.a) && !opts.tables.includes(p.b)) continue;
    if (opts.tables?.length && op === "÷" && !opts.tables.includes(p.b)) continue;
    const text = p.text.trim().replace(/\s+/g, " ");
    if (!mentions(text, p.a) || !mentions(text, p.b)) continue; // the numbers must be in the story
    if (!cleanText(text)) continue;
    if (!AskItem.safeParse({ text, answer }).success) continue;
    if (seen.has(text)) continue;
    seen.add(text);
    const near = [...new Set([answer + 1, answer - 1, answer + 10, answer - 10, answer + 2].filter((n) => n >= 0 && n !== answer))].slice(0, 4);
    out.push({ text, answer, near });
  }
  return out;
}

/** Keeps only multiple-choice items that are well formed, clean, with one right and three different wrong answers. */
export function verifyItems(raw: AiItem[]): BankItem[] {
  const out: BankItem[] = [];
  const seen = new Set<string>();
  for (const it of raw) {
    const q = it.question?.trim().replace(/\s+/g, " ");
    const a = it.correct?.trim();
    const w = (it.wrong ?? []).map((x) => x?.trim()).filter(Boolean);
    const p = it.passage?.trim().replace(/\s+/g, " ") || undefined;
    if (!q || !a || w.length !== 3) continue;
    const all = [a, ...w].map((x) => x.toLowerCase());
    if (new Set(all).size !== 4) continue;
    if (![q, a, ...w, ...(p ? [p] : [])].every(cleanText)) continue;
    const item = { q, a, w, ...(p ? { p } : {}) };
    if (!BankItem.safeParse(item).success) continue;
    const key = (p ?? "") + q;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function cleanText(t: string): boolean {
  return checkPublicText(t).ok && checkProtectedNames(t).ok && !/[<>`\\]/.test(t);
}

/** Which maths topics get AI word problems, and with which operations. */
export const WORD_PROBLEM_TOPICS: Record<string, Op[]> = {
  "facts-10": ["+", "-"],
  "facts-20": ["+", "-"],
  "add-sub-2digit": ["+", "-"],
  borrowing: ["-"],
  "add-sub-3digit": ["+", "-"],
  "times-tables": ["×"],
  division: ["÷"],
  "mul-2x1": ["×"],
  money: ["+", "-"],
};

/** Largest number allowed in a word problem for a topic and year. */
export function maxFor(topic: string, year: 2 | 3): number {
  if (topic === "facts-10") return 10;
  if (topic === "facts-20") return 20;
  if (topic === "times-tables" || topic === "division") return 144;
  return year === 2 ? 100 : 1000;
}
