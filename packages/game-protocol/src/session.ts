import { MAX_ANSWERS_PER_PLAY, parseGameMessage, type GameEvent } from "./messages";

export type PlayFlag =
  /** the totals sent with game_completed differ from the answer events counted by the page */
  | "tally_mismatch";

export interface CompletedPlay {
  startedAt: number;
  endedAt: number;
  /** measured by the page, never sent by the game */
  durationMs: number;
  /** as reported by the game in game_completed */
  correct: number;
  total: number;
  /** as counted by the page from answer events */
  countedAnswers: number;
  countedCorrect: number;
  flags: PlayFlag[];
}

export type HandleResult =
  | { accepted: false; reason: "invalid" | "rate_limited" | "not_started" | "too_many_answers" }
  | { accepted: true; event: GameEvent; completed?: CompletedPlay; abandoned?: boolean };

export interface PlaySessionOptions {
  now?: () => number;
  /** messages accepted per rolling second; the rest are dropped */
  maxMessagesPerSecond?: number;
}

/**
 * Host-side state machine for one game iframe. It turns raw postMessage data into
 * a sequence of plays: game_started -> answer* -> game_completed.
 * Duration is measured here, with the page's own clock.
 */
export class PlaySession {
  private readonly now: () => number;
  private readonly maxPerSecond: number;
  private recent: number[] = [];
  private current: { startedAt: number; answers: number; correct: number } | null = null;

  constructor(opts: PlaySessionOptions = {}) {
    this.now = opts.now ?? (() => Date.now());
    this.maxPerSecond = opts.maxMessagesPerSecond ?? 20;
  }

  get playing(): boolean {
    return this.current !== null;
  }

  get answersSoFar(): { answers: number; correct: number } {
    return { answers: this.current?.answers ?? 0, correct: this.current?.correct ?? 0 };
  }

  handle(raw: unknown): HandleResult {
    const t = this.now();
    this.recent = this.recent.filter((x) => t - x < 1000);
    if (this.recent.length >= this.maxPerSecond) return { accepted: false, reason: "rate_limited" };
    this.recent.push(t);

    const ev = parseGameMessage(raw);
    if (!ev) return { accepted: false, reason: "invalid" };

    switch (ev.event) {
      case "game_started": {
        const abandoned = this.current !== null;
        this.current = { startedAt: t, answers: 0, correct: 0 };
        return { accepted: true, event: ev, abandoned };
      }
      case "answer": {
        if (!this.current) return { accepted: false, reason: "not_started" };
        if (this.current.answers >= MAX_ANSWERS_PER_PLAY) return { accepted: false, reason: "too_many_answers" };
        this.current.answers++;
        if (ev.correct) this.current.correct++;
        return { accepted: true, event: ev };
      }
      case "game_completed": {
        if (!this.current) return { accepted: false, reason: "not_started" };
        const c = this.current;
        this.current = null;
        const flags: PlayFlag[] = [];
        if (c.answers !== ev.total || c.correct !== ev.correct) flags.push("tally_mismatch");
        return {
          accepted: true,
          event: ev,
          completed: {
            startedAt: c.startedAt,
            endedAt: t,
            durationMs: t - c.startedAt,
            correct: ev.correct,
            total: ev.total,
            countedAnswers: c.answers,
            countedCorrect: c.correct,
            flags,
          },
        };
      }
    }
  }

  /** Call when the player leaves the page or the iframe is reloaded. */
  reset(): boolean {
    const wasPlaying = this.current !== null;
    this.current = null;
    return wasPlaying;
  }
}
