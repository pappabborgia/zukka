import { z } from "zod";
import { Hex, Icon, nameText, safeText } from "../text";

/** Generators that exist in the School Cup template (checked against the template by a test). */
export const Q_GENERATORS = [
  "angles", "biggestFrac", "bonds20", "change", "change3", "coins", "coins2", "colAdd", "colSub", "compare", "count", "divide",
  "equiv24", "equivFrac", "facts10", "fracAddSub", "fracAmount", "fracEasy", "fracOf2", "hHund", "hOnes", "hTens", "half",
  "measures", "missTimes", "missing20", "missing3", "moreLess", "mul2x1", "oddEven", "oddEvenSmall", "perimeter", "place2",
  "place3", "scaling", "shapes2d", "shapes3d", "tdOnes", "tdOnesEasy", "tdTens", "tdtdAdd", "tdtdEasy", "tdtdSub",
  "tdtdSubEasy", "tenths", "three1", "time3", "timeFacts2", "times", "turns",
] as const;
export const T_GENERATORS = ["capitals", "comma", "fixSpelling", "homophone", "join", "opposite", "owner", "past", "perfect", "short", "speech"] as const;
export const T_DATA = ["HOMO2", "HOMO3", "OWN2", "OWN3", "SUF2", "SUF3"] as const;
export const BANK_KEYS = ["R2", "R3", "W2", "W3"] as const;
export const SPECIALS = ["syllables", "alphabetical"] as const;

const Num = z.number().int().min(0).max(10000);
const QArg = z.union([Num, z.array(Num).min(1).max(12)]);

export const BankItem = z.object({
  q: safeText(1, 220),
  a: safeText(1, 80),
  w: z.array(safeText(1, 80)).length(3),
  p: safeText(1, 700).optional(),
});
export type BankItem = z.infer<typeof BankItem>;

/** A worded maths question whose answer the platform computed (never typed in by hand). */
export const AskItem = z.object({
  text: safeText(5, 220),
  answer: z.number().int().min(0).max(100000),
  near: z.array(z.number().int().min(0).max(100000)).max(6).optional(),
});

export const GenRef = z.union([
  z.object({ q: z.enum(Q_GENERATORS), a: z.array(QArg).max(3).optional() }).strict(),
  z.object({ bank: z.enum(BANK_KEYS), stage: z.number().int().min(0).max(5) }).strict(),
  z.object({ items: z.array(BankItem).min(1).max(200) }).strict(),
  z.object({ t: z.enum(T_GENERATORS), a: z.array(z.union([z.enum(T_DATA), z.enum(BANK_KEYS)])).max(1).optional() }).strict(),
  z.object({ special: z.enum(SPECIALS) }).strict(),
  z.object({ asks: z.array(AskItem).min(1).max(200) }).strict(),
]);
export type GenRef = z.infer<typeof GenRef>;

export const Stage = z.object({
  desc: safeText(1, 140),
  secs: z.number().int().min(10).max(120),
  gens: z.array(GenRef).min(1).max(12),
});
export type Stage = z.infer<typeof Stage>;

const YearId = z.union([z.literal(2), z.literal(3)]);
const YearKey = z.enum(["2", "3"]);
const Info = z.partialRecord(YearKey, safeText(1, 300));

const Pattern = z.enum(["plain", "stripes", "hoops", "halves", "sash", "fade"]);
export const Team = z
  .object({
    name: nameText(2, 34),
    c1: Hex,
    c2: Hex,
    pattern: Pattern,
    p1: Hex.optional(),
    p2: Hex.optional(),
    ink: Hex,
    initials: z.string().regex(/^[A-Z0-9]{1,3}$/).optional(),
  })
  .strict();
export type Team = z.infer<typeof Team>;
const Nation = z.object({ name: nameText(2, 34), flag: Icon, c1: Hex, c2: Hex }).strict();

export const SubjectId = z.enum(["maths", "reading", "writing"]);
const RegularSubject = z
  .object({
    id: SubjectId,
    name: nameText(2, 20),
    icon: Icon,
    col: Hex,
    info: Info,
    years: z.partialRecord(YearKey, z.array(Stage).length(6)),
  })
  .strict();
const Phonics = z
  .object({ id: z.literal("phonics"), builtin: z.literal("phonics"), name: nameText(2, 20), icon: Icon, col: Hex, info: Info })
  .strict();
const Mix = z
  .object({
    id: z.literal("mix"),
    builtin: z.literal("mix"),
    from: z.array(SubjectId).min(2),
    name: nameText(2, 20),
    icon: Icon,
    col: Hex,
    info: Info,
  })
  .strict();

export const SchoolCupConfig = z
  .object({
    engine: z.literal("school-cup"),
    version: z.literal(1),
    title: nameText(3, 40),
    tagline: safeText(1, 160),
    years: z.array(z.object({ id: YearId, label: nameText(2, 20), icon: Icon }).strict()).min(1).max(2),
    teams: z
      .object({
        home: Team,
        homeExtra: z.array(nameText(2, 34)).max(3),
        clubs: z.array(Team).min(8).max(24),
        giants: z.array(Team).min(3).max(6),
        nations: z.array(Nation).min(6).max(24),
      })
      .strict(),
    tournaments: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-z0-9-]{2,20}$/),
            name: nameText(3, 40),
            icon: Icon,
            col: Hex,
            tag: safeText(1, 60),
            draw: z.enum(["league", "league-giant", "clubs-nations-giant", "giants", "nations"]),
          })
          .strict(),
      )
      .min(1)
      .max(5),
    subjects: z.array(z.union([RegularSubject, Phonics, Mix])).min(1).max(5),
    bank: z.partialRecord(z.enum(BANK_KEYS), z.array(z.array(BankItem).min(1)).length(6)),
  })
  .strict()
  .superRefine((c, ctx) => {
    const years = new Set(c.years.map((y) => String(y.id)));
    const regular = c.subjects.filter((s): s is z.infer<typeof RegularSubject> => !("builtin" in s));
    if (regular.length === 0) ctx.addIssue({ code: "custom", message: "at least one subject with questions" });
    const ids = c.subjects.map((s) => s.id);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: "subjects must be unique" });
    for (const s of regular) {
      for (const y of years)
        if (!s.years[y as "2" | "3"]) ctx.addIssue({ code: "custom", message: `${s.id} has no stages for year ${y}` });
      for (const [y, stages] of Object.entries(s.years)) {
        if (!years.has(y)) ctx.addIssue({ code: "custom", message: `${s.id} has stages for year ${y}, which is not offered` });
        for (const st of stages ?? [])
          for (const g of st.gens) {
            if ("bank" in g && !c.bank[g.bank]) ctx.addIssue({ code: "custom", message: `bank ${g.bank} is missing` });
            if ("t" in g && g.t === "fixSpelling") {
              const k = g.a?.[0];
              if (!k || !(BANK_KEYS as readonly string[]).includes(k) || !c.bank[k as (typeof BANK_KEYS)[number]])
                ctx.addIssue({ code: "custom", message: "fixSpelling needs a bank that is present" });
            }
          }
      }
    }
    for (const s of c.subjects)
      if ("builtin" in s && s.builtin === "mix")
        for (const f of s.from) if (!ids.includes(f)) ctx.addIssue({ code: "custom", message: `mix uses ${f}, which is missing` });
  });
export type SchoolCupConfig = z.infer<typeof SchoolCupConfig>;
