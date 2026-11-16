/**
 * Every engine template carries its default configuration between two comment markers,
 * ZUKKA_CONFIG and END_ZUKKA_CONFIG, right after "const CONFIG =".
 * A created game is the same template with another configuration in that place.
 */
const START = "/*ZUKKA_CONFIG*/";
const END = "/*END_ZUKKA_CONFIG*/";

export function extractConfig(template: string): unknown {
  const i = template.indexOf(START);
  const j = template.indexOf(END, i);
  if (i < 0 || j < 0 || template.indexOf(START, i + 1) >= 0) throw new Error("template has no single CONFIG block");
  return JSON.parse(template.slice(i + START.length, j).replace(/<\\\//g, "</"));
}

/** JSON that is safe inside an inline <script>: no "</" can close it, no U+2028/2029 can break it. */
export function scriptSafeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function injectConfig(template: string, config: unknown): string {
  const i = template.indexOf(START);
  const j = template.indexOf(END, i);
  if (i < 0 || j < 0) throw new Error("template has no CONFIG block");
  return template.slice(0, i + START.length) + scriptSafeJson(config) + template.slice(j);
}

/** Largest game Zukka stores and serves (one Firestore document is at most 1 MiB). */
export const MAX_GAME_BYTES = 700 * 1024;

export const byteSize = (s: string) => new TextEncoder().encode(s).length;

export class GameTooLargeError extends Error {
  constructor(public bytes: number) {
    super(`game is ${Math.round(bytes / 1024)} KB, the limit is ${MAX_GAME_BYTES / 1024} KB`);
  }
}

export function assertGameSize(s: string): number {
  const bytes = byteSize(s);
  if (bytes > MAX_GAME_BYTES) throw new GameTooLargeError(bytes);
  return bytes;
}
