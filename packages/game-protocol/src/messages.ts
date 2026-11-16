import { z } from "zod";

/** Version tag every game message must carry. */
export const PROTOCOL = "zukka/1";

/** Upper bound for answers in a single play. A real game never gets close. */
export const MAX_ANSWERS_PER_PLAY = 500;

const protocol = z.literal(PROTOCOL);

export const GameStartedMessage = z.object({
  protocol,
  event: z.literal("game_started"),
});

export const AnswerMessage = z.object({
  protocol,
  event: z.literal("answer"),
  data: z.object({ correct: z.boolean() }),
});

export const GameCompletedMessage = z.object({
  protocol,
  event: z.literal("game_completed"),
  data: z
    .object({
      correct: z.number().int().min(0).max(MAX_ANSWERS_PER_PLAY),
      total: z.number().int().min(1).max(MAX_ANSWERS_PER_PLAY),
    })
    .refine((d) => d.correct <= d.total, { message: "correct cannot exceed total" }),
});

/**
 * The only three messages a game may send. Unknown keys are stripped by Zod,
 * so whatever else a game puts in a message never reaches the platform.
 */
export const GameMessage = z.discriminatedUnion("event", [
  GameStartedMessage,
  AnswerMessage,
  GameCompletedMessage,
]);

export type GameEvent =
  | { event: "game_started" }
  | { event: "answer"; correct: boolean }
  | { event: "game_completed"; correct: number; total: number };

/** Validates a raw message and returns a minimal, normalised event, or null. */
export function parseGameMessage(raw: unknown): GameEvent | null {
  const r = GameMessage.safeParse(raw);
  if (!r.success) return null;
  const m = r.data;
  switch (m.event) {
    case "game_started":
      return { event: "game_started" };
    case "answer":
      return { event: "answer", correct: m.data.correct };
    case "game_completed":
      return { event: "game_completed", correct: m.data.correct, total: m.data.total };
  }
}

/**
 * A message is accepted only when it comes from our own game iframe, and that
 * iframe is sandboxed without allow-same-origin (its origin is then the string "null").
 * A message with any other origin means the sandbox is not in place, so it is refused.
 */
export function isFromGameFrame(
  ev: { source: unknown; origin: string },
  frameWindow: unknown,
): boolean {
  return frameWindow != null && ev.source === frameWindow && ev.origin === "null";
}
