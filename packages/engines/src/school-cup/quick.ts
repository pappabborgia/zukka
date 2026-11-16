import { z } from "zod";
import { Hex, nameText } from "../text";
import { SchoolCupConfig, type BankItem, type GenRef, type Stage, type Team } from "./schema";
import { TIMES_TABLES, topicById, type Band } from "./topics";

/** The palette offered in the form (good contrast with white or dark initials). */
export const TEAM_COLOURS = [
  "#e8590c", "#f08c00", "#f59f00", "#2f9e44", "#0ca678", "#1c7ed6", "#1971c2", "#3b5bdb",
  "#7048e8", "#ae3ec9", "#d6336c", "#e03131", "#212529", "#868e96", "#ffffff", "#ffd43b",
] as const;
export const PATTERNS = ["plain", "stripes", "hoops", "halves", "sash"] as const;

/** What the parent fills in on /studio/new/school-cup. */
export const SchoolCupQuickForm = z
  .object({
    title: nameText(3, 40),
    tournamentName: nameText(3, 40),
    teamName: nameText(3, 24),
    colour1: Hex,
    colour2: Hex,
    pattern: z.enum(PATTERNS),
    subject: z.enum(["maths", "reading", "writing"]),
    year: z.union([z.literal(2), z.literal(3)]),
    topics: z.array(z.string().max(40)).min(1).max(6),
    tables: z.array(z.number().int()).max(11).default([]),
  })
  .strict()
  .superRefine((f, ctx) => {
    if (f.colour1.toLowerCase() === f.colour2.toLowerCase())
      ctx.addIssue({ code: "custom", path: ["colour2"], message: "choose two different colours" });
    const seen = new Set<string>();
    for (const id of f.topics) {
      const t = topicById(id);
      if (!t || t.subject !== f.subject || !t.years.includes(f.year))
        ctx.addIssue({ code: "custom", path: ["topics"], message: `topic ${id} does not fit ${f.subject}, Year ${f.year}` });
      if (seen.has(id)) ctx.addIssue({ code: "custom", path: ["topics"], message: "each topic once" });
      seen.add(id);
    }
    const needsTables = f.topics.some((id) => topicById(id)?.usesTables);
    if (needsTables && f.tables.length === 0) ctx.addIssue({ code: "custom", path: ["tables"], message: "choose at least one times table" });
    if (f.tables.some((n) => !(TIMES_TABLES as readonly number[]).includes(n)))
      ctx.addIssue({ code: "custom", path: ["tables"], message: "tables go from 2 to 12" });
  });
export type SchoolCupQuickForm = z.infer<typeof SchoolCupQuickForm>;

/** Extra questions written for a topic by the AI (reading and writing, word problems), already checked. */
export interface ExtraQuestions {
  /** multiple-choice items per topic id */
  items?: Record<string, BankItem[]>;
  /** maths word problems per topic id, with answers computed by the platform */
  asks?: Record<string, { text: string; answer: number; near?: number[] }[]>;
}

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const inkFor = (bg: string) => (luminance(bg) > 0.45 ? "#14233b" : "#ffffff");

export function initialsOf(name: string): string {
  const w = name.split(/[\s-]+/).filter((x) => /[\p{L}\p{N}]/u.test(x));
  const raw = w.length > 1 ? w[0][0] + w[1][0] : name.replace(/[^\p{L}\p{N}]/gu, "").slice(0, 2);
  const ascii = raw.normalize("NFD").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return ascii.slice(0, 3) || "ZK";
}

const SECS: Record<2 | 3, number[]> = { 2: [38, 36, 35, 34, 34, 32], 3: [28, 27, 26, 26, 26, 24] };
const READING_SECS = { 2: 45, 3: 38 };
const SUBJECT_STYLE = {
  maths: { name: "Maths", icon: "🔢", col: "#2f6fed" },
  reading: { name: "Reading", icon: "📖", col: "#e8590c" },
  writing: { name: "Writing", icon: "✏️", col: "#9c36b5" },
} as const;

/**
 * Builds the six rounds from the chosen topics.
 * Maths: every topic in every round, with numbers that grow by band (rounds 1-2, 3-4, 5-6).
 * Reading and writing: topics spread over the rounds in curriculum order, each round revising the one before.
 */
export function buildStages(form: SchoolCupQuickForm, extra: ExtraQuestions = {}): Stage[] {
  const topics = form.topics.map((id) => topicById(id)!);
  const opts = { tables: [...form.tables].sort((a, b) => a - b) };
  const label = (ids: string[]) => ids.map((id) => topicById(id)!.label.toLowerCase()).join(", ").slice(0, 140);
  const withExtras = (id: string, gens: GenRef[]): GenRef[] => {
    const out = [...gens];
    const items = extra.items?.[id];
    if (items?.length) out.push({ items }, { items });
    const asks = extra.asks?.[id];
    if (asks?.length) out.push({ asks });
    return out.slice(0, 12);
  };
  if (form.subject === "maths") {
    return [0, 1, 2, 3, 4, 5].map((i) => {
      const band = Math.floor(i / 2) as Band;
      const gens = topics.flatMap((t) => withExtras(t.id, t.gens(band, form.year, opts))).slice(0, 12);
      return { desc: label(form.topics), secs: SECS[form.year][i], gens };
    });
  }
  const ordered = [...topics].sort((a, b) => (a.bankStage!.stage - b.bankStage!.stage));
  return [0, 1, 2, 3, 4, 5].map((i) => {
    const k = Math.min(ordered.length - 1, Math.floor((i * ordered.length) / 6));
    const main = ordered[k];
    const prev = k > 0 && i % 2 === 1 ? ordered[k - 1] : null;
    const gens = [...withExtras(main.id, main.gens(0, form.year, opts)), ...(prev ? withExtras(prev.id, prev.gens(0, form.year, opts)).slice(0, 2) : [])];
    const ids = prev ? [main.id, prev.id] : [main.id];
    return { desc: label(ids), secs: READING_SECS[form.year] + (main.bankStage!.stage >= 3 && form.subject === "reading" ? 10 : 0), gens: gens.slice(0, 12) };
  });
}

/** The configuration of a quick game: the default School Cup with the parent's choices. */
export function buildQuickConfig(base: SchoolCupConfig, rawForm: unknown, extra: ExtraQuestions = {}): SchoolCupConfig {
  const form = SchoolCupQuickForm.parse(rawForm);
  const style = SUBJECT_STYLE[form.subject];
  const yearLabel = `Year ${form.year}`;
  const home: Team = {
    name: form.teamName,
    c1: form.colour1,
    c2: form.colour2,
    pattern: form.pattern,
    ink: inkFor(form.colour1),
    initials: initialsOf(form.teamName),
  };
  const stages = buildStages(form, extra);
  const bankKeys = new Set<string>();
  for (const st of stages)
    for (const g of st.gens) {
      if ("bank" in g) bankKeys.add(g.bank);
      if ("t" in g && g.t === "fixSpelling" && g.a?.[0]) bankKeys.add(g.a[0]);
    }
  const topicNames = form.topics.map((id) => topicById(id)!.label.toLowerCase());
  const tagline = `${yearLabel} ${style.name.toLowerCase()}: ${topicNames.join(", ")}. Answer right to pass, score goals and lift the trophy!`;
  const config = {
    engine: "school-cup",
    version: 1,
    title: form.title,
    tagline: tagline.length <= 160 ? tagline : `${yearLabel} ${style.name.toLowerCase()}. Answer right to pass, score goals and lift the trophy!`,
    years: [base.years.find((y) => y.id === form.year) ?? { id: form.year, label: yearLabel, icon: form.year === 2 ? "🦁" : "🐯" }],
    teams: { ...base.teams, home, homeExtra: [] },
    tournaments: [{ id: "custom", name: form.tournamentName, icon: "🏆", col: form.colour1 === "#ffffff" ? form.colour2 : form.colour1, tag: "Six rounds to the trophy", draw: "league-giant" as const }],
    subjects: [
      {
        id: form.subject,
        ...style,
        info: { [String(form.year)]: `${yearLabel} ${style.name.toLowerCase()}: ${topicNames.join(", ")}.`.slice(0, 300) },
        years: { [String(form.year)]: stages },
      },
    ],
    bank: Object.fromEntries([...bankKeys].map((k) => [k, base.bank[k as keyof typeof base.bank]])),
  };
  return SchoolCupConfig.parse(config);
}
