import { z } from "zod";

/** Colours are only #rrggbb: they end up in CSS inside the game. */
export const Hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "colour must be #rrggbb");

/**
 * Text shown in a game: no angle brackets, backticks, backslashes or control characters,
 * so it can never become markup or script even where a game uses innerHTML.
 */
export const safeText = (min: number, max: number) =>
  z
    .string()
    .min(min)
    .max(max)
    .refine((s) => !/[<>`\\\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(s), "text contains characters that are not allowed")
    .refine((s) => s.trim() === s || s.length === 0, "no spaces at the start or end");

/** Names (teams, places, titles): letters, digits, spaces and a little punctuation. */
export const nameText = (min: number, max: number) =>
  z
    .string()
    .min(min)
    .max(max)
    .regex(/^[\p{L}\p{N}][\p{L}\p{N} '’.&!?,:\-]*$/u, "only letters, numbers, spaces and . , ' & ! ? : -");

/** A short emoji or symbol (icons, flags). */
export const Icon = z
  .string()
  .min(1)
  .max(16)
  .refine((s) => !/[\p{L}\p{N}<>`\\]/u.test(s.replace(/[\u{1F1E6}-\u{1F1FF}]/gu, "")), "icon must be an emoji");
