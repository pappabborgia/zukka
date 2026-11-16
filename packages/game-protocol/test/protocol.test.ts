import { describe, expect, it } from "vitest";
import {
  PlaySession,
  gameContentSecurityPolicy,
  gameResponseHeaders,
  isFromGameFrame,
  parseGameMessage,
} from "../src";

const msg = (event: string, data?: unknown) => ({ protocol: "zukka/1", event, ...(data === undefined ? {} : { data }) });

describe("parseGameMessage", () => {
  it("accepts the three events", () => {
    expect(parseGameMessage(msg("game_started"))).toEqual({ event: "game_started" });
    expect(parseGameMessage(msg("answer", { correct: true }))).toEqual({ event: "answer", correct: true });
    expect(parseGameMessage(msg("game_completed", { correct: 7, total: 10 }))).toEqual({
      event: "game_completed",
      correct: 7,
      total: 10,
    });
  });

  it("drops every extra field the game sends", () => {
    const ev = parseGameMessage({ ...msg("answer", { correct: false, score: 9999, name: "x" }), points: 50 });
    expect(ev).toEqual({ event: "answer", correct: false });
  });

  it.each([
    ["wrong protocol", { protocol: "zukka/2", event: "game_started" }],
    ["unknown event", msg("give_points", { points: 100 })],
    ["string instead of boolean", msg("answer", { correct: "true" })],
    ["missing data", msg("answer")],
    ["more correct than total", msg("game_completed", { correct: 11, total: 10 })],
    ["zero total", msg("game_completed", { correct: 0, total: 0 })],
    ["negative", msg("game_completed", { correct: -1, total: 5 })],
    ["fraction", msg("game_completed", { correct: 1.5, total: 5 })],
    ["absurd total", msg("game_completed", { correct: 1, total: 100000 })],
    ["not an object", "game_started"],
    ["null", null],
  ])("rejects %s", (_name, raw) => {
    expect(parseGameMessage(raw)).toBeNull();
  });
});

describe("isFromGameFrame", () => {
  const frame = {};
  it("accepts only our sandboxed frame", () => {
    expect(isFromGameFrame({ source: frame, origin: "null" }, frame)).toBe(true);
  });
  it("rejects another window", () => {
    expect(isFromGameFrame({ source: {}, origin: "null" }, frame)).toBe(false);
  });
  it("rejects a frame that is not sandboxed (real origin)", () => {
    expect(isFromGameFrame({ source: frame, origin: "https://zukka-play.vercel.app" }, frame)).toBe(false);
  });
  it("rejects when there is no frame", () => {
    expect(isFromGameFrame({ source: null, origin: "null" }, null)).toBe(false);
  });
});

describe("PlaySession", () => {
  const clock = () => {
    let t = 1_000_000;
    return { now: () => t, tick: (ms: number) => (t += ms) };
  };

  it("measures a full play with its own clock", () => {
    const c = clock();
    const s = new PlaySession({ now: c.now });
    expect(s.handle(msg("game_started")).accepted).toBe(true);
    for (const ok of [true, false, true]) {
      c.tick(5000);
      s.handle(msg("answer", { correct: ok }));
    }
    c.tick(2000);
    const r = s.handle(msg("game_completed", { correct: 2, total: 3 }));
    expect(r.accepted && r.completed).toMatchObject({
      durationMs: 17000,
      correct: 2,
      total: 3,
      countedAnswers: 3,
      countedCorrect: 2,
      flags: [],
    });
    expect(s.playing).toBe(false);
  });

  it("flags a game whose totals differ from the answers it sent", () => {
    const s = new PlaySession();
    s.handle(msg("game_started"));
    s.handle(msg("answer", { correct: false }));
    const r = s.handle(msg("game_completed", { correct: 20, total: 20 }));
    expect(r.accepted && r.completed?.flags).toEqual(["tally_mismatch"]);
  });

  it("ignores answers and completion before game_started", () => {
    const s = new PlaySession();
    expect(s.handle(msg("answer", { correct: true }))).toEqual({ accepted: false, reason: "not_started" });
    expect(s.handle(msg("game_completed", { correct: 1, total: 1 }))).toEqual({ accepted: false, reason: "not_started" });
  });

  it("does not accept a second completion for the same play", () => {
    const s = new PlaySession();
    s.handle(msg("game_started"));
    s.handle(msg("answer", { correct: true }));
    expect(s.handle(msg("game_completed", { correct: 1, total: 1 })).accepted).toBe(true);
    expect(s.handle(msg("game_completed", { correct: 1, total: 1 }))).toEqual({ accepted: false, reason: "not_started" });
  });

  it("treats a new game_started as abandoning the previous play", () => {
    const s = new PlaySession();
    s.handle(msg("game_started"));
    s.handle(msg("answer", { correct: true }));
    const r = s.handle(msg("game_started"));
    expect(r).toMatchObject({ accepted: true, abandoned: true });
    expect(s.answersSoFar).toEqual({ answers: 0, correct: 0 });
  });

  it("drops a flood of messages", () => {
    const c = clock();
    const s = new PlaySession({ now: c.now, maxMessagesPerSecond: 20 });
    s.handle(msg("game_started"));
    const results = Array.from({ length: 50 }, () => s.handle(msg("answer", { correct: true })));
    expect(results.filter((r) => r.accepted)).toHaveLength(19);
    expect(results.at(-1)).toEqual({ accepted: false, reason: "rate_limited" });
    c.tick(1001);
    expect(s.handle(msg("answer", { correct: true })).accepted).toBe(true);
  });

  it("caps the answers in one play", () => {
    const c = clock();
    const s = new PlaySession({ now: c.now });
    s.handle(msg("game_started"));
    let last;
    for (let i = 0; i < 501; i++) {
      c.tick(100);
      last = s.handle(msg("answer", { correct: true }));
    }
    expect(last).toEqual({ accepted: false, reason: "too_many_answers" });
  });
});

describe("game headers", () => {
  const csp = gameContentSecurityPolicy(["https://zukka.vercel.app"]);
  it("blocks every network request and keeps the sandbox", () => {
    for (const d of [
      "default-src 'none'",
      "connect-src 'none'",
      "form-action 'none'",
      "frame-src 'none'",
      "worker-src 'none'",
      "base-uri 'none'",
      "sandbox allow-scripts",
      "frame-ancestors https://zukka.vercel.app",
    ])
      expect(csp).toContain(d);
    expect(csp).not.toMatch(/unsafe-eval|https?:\/\/(?!zukka\.vercel\.app)|\*/);
    expect(csp).not.toContain("allow-same-origin");
  });
  it("refuses to be framed when no ancestor is configured", () => {
    expect(gameContentSecurityPolicy([])).toContain("frame-ancestors 'none'");
  });
  it("sets the other safety headers", () => {
    const h = gameResponseHeaders({ frameAncestors: ["https://zukka.vercel.app"] });
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["Referrer-Policy"]).toBe("no-referrer");
    expect(h["Permissions-Policy"]).toContain("microphone=()");
    expect(h["Permissions-Policy"]).toContain("camera=()");
  });
});
