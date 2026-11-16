import { PATTERNS, TEAM_COLOURS, TIMES_TABLES, TOPICS } from "@zukka/engines";
import type { QuickValues, TopicChoice } from "@/components/QuickGameForm";
import type { GameStatus } from "./server/games";

/** Plain data for the quick form (the topic generators stay on the server). */
export const TOPIC_CHOICES: TopicChoice[] = TOPICS.map((t) => ({
  id: t.id,
  subject: t.subject,
  years: t.years,
  label: t.label,
  ...(t.hint ? { hint: t.hint } : {}),
  ...(t.usesTables ? { usesTables: true } : {}),
}));
export { PATTERNS, TEAM_COLOURS, TIMES_TABLES };

export const NEW_QUICK_DEFAULTS: QuickValues = {
  title: "",
  tournamentName: "",
  teamName: "",
  colour1: "#7048e8",
  colour2: "#ffd43b",
  pattern: "stripes",
  subject: "maths",
  year: 2,
  topics: [],
  tables: [],
};

export const STATUS_LABEL: Record<GameStatus, string> = {
  draft: "Draft",
  submitted: "Sent for review",
  ai_reviewed: "In review",
  changes_requested: "Changes requested",
  approved: "Published",
  rejected: "Not accepted",
  removed: "Removed",
};
