/**
 * Limits for creating games (test phase). Change them here.
 * AI generations cost money, so they are limited per game, per account per day, and globally per month.
 */
export const STUDIO_LIMITS = {
  /** games in "draft" at the same time, per account */
  maxDrafts: 5,
  /** saved versions per game (quick versions are cheap, but they are stored) */
  maxVersionsPerGame: 30,
  /** AI generations per game */
  aiGenerationsPerGame: 10,
  /** AI generations per account per day (UTC) */
  aiGenerationsPerAccountPerDay: 10,
  /** monthly AI spend for the whole platform, in US dollars; over it, AI creation stops and the admins get an email */
  monthlyAiBudgetUsd: Number(process.env.AI_MONTHLY_BUDGET_USD ?? 20),
} as const;
