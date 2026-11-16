import type { GenRef } from "./schema";

/**
 * Topics a parent can pick in the quick creation form, for each subject and year.
 * Maths topics use the generators already in the game (answers computed by code),
 * with harder numbers in later rounds. Reading and writing topics use the question bank
 * stages (and, once the AI is on, extra questions generated for the topic).
 */
export type Band = 0 | 1 | 2; // rounds 1-2, 3-4, 5-6
export interface TopicOptions {
  tables: number[];
}
export interface Topic {
  id: string;
  subject: "maths" | "reading" | "writing";
  years: (2 | 3)[];
  label: string;
  /** shown in the form, under the label */
  hint?: string;
  /** needs the times-table picker */
  usesTables?: boolean;
  /** generators for each band of rounds */
  gens: (band: Band, year: 2 | 3, o: TopicOptions) => GenRef[];
  /** for reading and writing: the bank stage this topic comes from */
  bankStage?: { key: "R2" | "R3" | "W2" | "W3"; stage: number };
}

const q = (name: string, ...a: unknown[]): GenRef => (a.length ? { q: name, a } : { q: name }) as GenRef;
const byBand = <T,>(band: Band, a: T, b: T, c: T) => [a, b, c][band];

export const MATHS_TOPICS: Topic[] = [
  { id: "facts-10", subject: "maths", years: [2], label: "Adding and taking away to 10",
    gens: (b) => byBand(b, [q("facts10")], [q("facts10"), q("bonds20")], [q("bonds20"), q("missing20")]) },
  { id: "facts-20", subject: "maths", years: [2, 3], label: "Number facts to 20",
    gens: (b) => byBand(b, [q("bonds20")], [q("bonds20"), q("missing20")], [q("missing20"), q("three1")]) },
  { id: "add-sub-2digit", subject: "maths", years: [2, 3], label: "Adding and taking away two-digit numbers",
    gens: (b) => byBand(b, [q("tdOnesEasy"), q("tdTens")], [q("tdtdEasy"), q("tdtdSubEasy"), q("tdOnes")], [q("tdtdAdd"), q("tdtdSub")]) },
  { id: "borrowing", subject: "maths", years: [2, 3], label: "Subtraction with borrowing",
    hint: "Taking away when you need to exchange a ten (or a hundred)",
    gens: (b, y) => (y === 2 ? byBand(b, [q("tdOnes")], [q("tdtdSubEasy"), q("tdtdSub")], [q("tdtdSub")]) : byBand(b, [q("tdtdSub")], [q("hTens"), q("colSub")], [q("colSub")])) },
  { id: "add-sub-3digit", subject: "maths", years: [3], label: "Adding and taking away three-digit numbers",
    gens: (b) => byBand(b, [q("hOnes"), q("hTens")], [q("hTens"), q("hHund")], [q("colAdd"), q("colSub")]) },
  { id: "counting", subject: "maths", years: [2, 3], label: "Counting in steps",
    hint: "2s, 3s, 5s and 10s in Year 2; 4s, 8s, 50s and 100s in Year 3",
    gens: (b, y) => (y === 2 ? byBand(b, [q("count", [2, 10])], [q("count", [5]), q("count", [2, 10])], [q("count", [3]), q("count", [5])])
                              : byBand(b, [q("count", [4, 100])], [q("count", [8, 50])], [q("count", [4, 8, 50, 100])])) },
  { id: "odd-even", subject: "maths", years: [2], label: "Odd and even numbers",
    gens: (b) => byBand(b, [q("oddEvenSmall")], [q("oddEvenSmall"), q("oddEven")], [q("oddEven")]) },
  { id: "place-value", subject: "maths", years: [2, 3], label: "Place value and comparing numbers",
    gens: (b, y) => (y === 2 ? byBand(b, [q("place2")], [q("place2"), q("compare", 99)], [q("compare", 99), q("tdTens")])
                              : byBand(b, [q("place3")], [q("place3"), q("moreLess")], [q("compare", 999), q("moreLess")])) },
  { id: "times-tables", subject: "maths", years: [2, 3], label: "Times tables", usesTables: true,
    hint: "Choose the tables below",
    gens: (b, _y, o) => byBand(b, [q("times", o.tables, 5)], [q("times", o.tables, 10)], [q("times", o.tables, 12), q("missTimes", o.tables)]) },
  { id: "division", subject: "maths", years: [2, 3], label: "Dividing (sharing)", usesTables: true,
    hint: "Uses the same tables",
    gens: (b, _y, o) => byBand(b, [q("divide", o.tables, 5)], [q("divide", o.tables, 10)], [q("divide", o.tables, 12)]) },
  { id: "mul-2x1", subject: "maths", years: [3], label: "Two-digit times one-digit",
    gens: (b) => byBand(b, [q("scaling")], [q("mul2x1"), q("scaling")], [q("mul2x1")]) },
  { id: "fractions", subject: "maths", years: [2, 3], label: "Fractions",
    gens: (b, y) => (y === 2 ? byBand(b, [q("half"), q("fracEasy")], [q("fracEasy"), q("fracOf2")], [q("fracOf2"), q("equiv24")])
                              : byBand(b, [q("tenths"), q("fracAmount")], [q("fracAmount"), q("equivFrac")], [q("fracAddSub"), q("biggestFrac")])) },
  { id: "money", subject: "maths", years: [2, 3], label: "Money and change",
    gens: (b, y) => (y === 2 ? byBand(b, [q("coins2")], [q("coins2"), q("change", [20])], [q("change", [20, 50])]) : byBand(b, [q("change", [50, 100])], [q("change3")], [q("change3")])) },
  { id: "time", subject: "maths", years: [2, 3], label: "Telling the time",
    gens: (_b, y) => (y === 2 ? [q("timeFacts2")] : [q("time3")]) },
  { id: "measures", subject: "maths", years: [3], label: "Measures and perimeter",
    gens: (b) => byBand(b, [q("measures")], [q("measures"), q("perimeter")], [q("perimeter")]) },
  { id: "shapes", subject: "maths", years: [2, 3], label: "Shapes, turns and angles",
    gens: (b, y) => (y === 2 ? byBand(b, [q("shapes2d")], [q("shapes2d"), q("shapes3d")], [q("shapes3d"), q("turns")]) : byBand(b, [q("turns")], [q("angles")], [q("angles")])) },
  { id: "missing-numbers", subject: "maths", years: [2, 3], label: "Mystery numbers",
    hint: "Find the missing number in a sum",
    gens: (_b, y) => (y === 2 ? [q("missing20")] : [q("missing3")]) },
];

/** Reading and writing topics: one per stage of the question bank, with the stage's description. */
const STAGES: Record<"R2" | "R3" | "W2" | "W3", string[]> = {
  R2: ["Rhymes and letter sounds", "Syllables and words that make sense", "Opposites, same meaning and suffix words",
       "Finding answers in a short text", "Clues: feelings and what happens next", "Stories, poems and information books"],
  R3: ["Prefixes: un-, re-, dis-, mis-, sub-, pre-", "Root words and suffixes", "Dictionary skills and word meanings",
       "Fiction, non-fiction, poems and plays", "Feelings and evidence from the text", "Main idea and summary of a paragraph"],
  W2: ["Spelling tricky words", "Homophones: see or sea, to, too or two", "Short forms (can't) and apostrophes (the girl's book)",
       "Suffixes: -ment, -ness, -ful, -less, -ly", "Capital letters, full stops, question marks and commas", "Past and present, joining words"],
  W3: ["Year 3 and 4 spelling words", "Prefixes and suffixes", "More homophones: break or brake",
       "Apostrophes for more than one owner", "Although, because, if; has gone, have seen", "Fronted adverbials, speech marks"],
};

/** Typed-answer exercises that go with some stages (the same as in the full game). */
const STAGE_EXTRAS: Partial<Record<string, GenRef[]>> = {
  "R2-1": [{ special: "syllables" }],
  "R3-2": [{ special: "alphabetical" }],
  "W2-0": [{ t: "fixSpelling", a: ["W2"] }],
  "W2-1": [{ t: "homophone", a: ["HOMO2"] }],
  "W2-2": [{ t: "short" }],
  "W2-3": [{ t: "join", a: ["SUF2"] }],
  "W2-5": [{ t: "past" }],
  "W3-0": [{ t: "fixSpelling", a: ["W3"] }],
  "W3-1": [{ t: "opposite" }, { t: "join", a: ["SUF3"] }],
  "W3-2": [{ t: "homophone", a: ["HOMO3"] }],
  "W3-3": [{ t: "owner", a: ["OWN3"] }],
  "W3-4": [{ t: "perfect" }],
  "W3-5": [{ t: "comma" }, { t: "speech" }],
};

function bankTopics(subject: "reading" | "writing"): Topic[] {
  const out: Topic[] = [];
  for (const year of [2, 3] as const) {
    const key = `${subject === "reading" ? "R" : "W"}${year}` as "R2" | "R3" | "W2" | "W3";
    STAGES[key].forEach((label, stage) => {
      const id = `${key}-${stage}`;
      out.push({
        id,
        subject,
        years: [year],
        label,
        bankStage: { key, stage },
        gens: () => [{ bank: key, stage }, { bank: key, stage }, ...(STAGE_EXTRAS[id] ?? [])],
      });
    });
  }
  return out;
}

export const TOPICS: Topic[] = [...MATHS_TOPICS, ...bankTopics("reading"), ...bankTopics("writing")];

export const topicsFor = (subject: string, year: 2 | 3) => TOPICS.filter((t) => t.subject === subject && t.years.includes(year));
export const topicById = (id: string) => TOPICS.find((t) => t.id === id);

export const TIMES_TABLES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
