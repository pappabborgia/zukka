import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { topicById, type ExtraQuestions, type SchoolCupQuickForm } from "@zukka/engines";
import { z } from "zod";
import { maxFor, verifyItems, verifyWordProblems, WORD_PROBLEM_TOPICS, type AiItem, type AiWordProblem } from "../ai-check";
import { recordUsage } from "./ai-budget";

/**
 * Extra questions for a quick game, written by Claude once when the game (or a new version) is saved,
 * then checked by code and stored in the game's config. Only fixed data goes into the prompt
 * (subject, year, topic labels from our list, chosen tables): never text typed by a parent.
 */
const MODEL = "claude-opus-5-5";

const ItemsOut = z.object({
  items: z.array(z.object({ question: z.string(), correct: z.string(), wrong: z.array(z.string()), passage: z.string().nullable() })),
});
const ProblemsOut = z.object({
  problems: z.array(z.object({ text: z.string(), a: z.number().int(), op: z.enum(["+", "-", "×", "÷"]), b: z.number().int(), answer: z.number().int() })),
});

const SYSTEM = `You write questions for Zukka, a website of learning games for children aged 6 to 9 in England.
Rules for everything you write:
- British English, short sentences, words a child of that age can read.
- Friendly and calm: nothing violent, scary, sad or unsuitable for young children.
- No real people, celebrities, brands, football clubs, films, games or characters that belong to someone else.
- If a story needs a person, use a simple first name (such as Sam, Mia, Ben, Ava, Theo, Zara, Tom or Isla) or "a friend".
- No links, emails, phone numbers, angle brackets, backslashes or backticks.
- Exactly one answer is right. The wrong answers must be clearly wrong for someone who knows the topic, but believable.`;

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic({ timeout: 90_000, maxRetries: 1 }));

async function ask<T>(schema: z.ZodType<T>, prompt: string): Promise<T | null> {
  const response = await anthropic().beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default", // if the request is declined, another model answers it inside the same call
    output_config: { effort: "medium", format: betaZodOutputFormat(schema) },
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });
  await recordUsage(response.usage).catch((e) => console.error("AI usage not recorded", e));
  if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") return null;
  return response.parsed_output ?? null;
}

const yearText = (y: 2 | 3) => `Year ${y} (age ${y === 2 ? "6 to 7" : "7 to 8"})`;

async function itemsFor(subject: "reading" | "writing", year: 2 | 3, topicLabel: string): Promise<AiItem[]> {
  const out = await ask(
    ItemsOut,
    `Write 14 multiple-choice ${subject} questions for ${yearText(year)}, on this topic of the National Curriculum for England: "${topicLabel}".
Each question: at most 200 characters; one correct answer and exactly 3 wrong answers, each at most 60 characters, all different.
${subject === "reading" ? 'Where the topic is about understanding a text, put a short passage (2 to 4 sentences, at most 400 characters) in "passage" and ask about it; otherwise set "passage" to null.' : 'Set "passage" to null, or use it for a sentence the question refers to (at most 200 characters).'}
Vary the questions: no two the same, mix easy and harder ones.`,
  );
  return out?.items ?? [];
}

async function problemsFor(topicLabel: string, year: 2 | 3, ops: string[], max: number, tables: number[]): Promise<AiWordProblem[]> {
  const tableRule = tables.length ? `Every multiplication or division must use one of these times tables: ${tables.join(", ")}.` : "";
  const out = await ask(
    ProblemsOut,
    `Write 12 short maths word problems for ${yearText(year)} on "${topicLabel}".
Each problem is one sum: a op b, with op one of ${ops.join(" ")}. Both numbers must appear as digits in the text, and no other numbers.
Numbers from 0 to ${max}. ${tableRule}
Subtractions never go below zero; divisions have no remainder.
"text" is the story and question (at most 200 characters), "a", "op", "b" the sum, "answer" the result.
Use everyday things: fruit, toys, stickers, books, pets, football, the park, the beach.`,
  );
  return out?.problems ?? [];
}

/** Writes and checks extra questions for every chosen topic that has them. Failures leave a topic without extras. */
export async function generateExtras(form: SchoolCupQuickForm): Promise<{ extra: ExtraQuestions; added: number }> {
  const extra: ExtraQuestions = { items: {}, asks: {} };
  let added = 0;
  await Promise.all(
    form.topics.map(async (id) => {
      const topic = topicById(id);
      if (!topic) return;
      try {
        if (form.subject === "maths") {
          const ops = WORD_PROBLEM_TOPICS[id];
          if (!ops) return;
          const tables = topic.usesTables ? form.tables : [];
          const raw = await problemsFor(topic.label, form.year, ops, maxFor(id, form.year), tables);
          const asks = verifyWordProblems(raw, { ops, max: maxFor(id, form.year), tables }).slice(0, 12);
          if (asks.length >= 3) {
            extra.asks![id] = asks;
            added += asks.length;
          }
        } else {
          const raw = await itemsFor(form.subject, form.year, topic.label);
          const items = verifyItems(raw).slice(0, 14);
          if (items.length >= 4) {
            extra.items![id] = items;
            added += items.length;
          }
        }
      } catch (e) {
        console.error(`AI questions for ${id} failed`, e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e);
      }
    }),
  );
  return { extra, added };
}
