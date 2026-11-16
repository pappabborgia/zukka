import { z } from "zod";
import { nameText, safeText } from "../text";

/** Race to Starfish Bay: a creator can rename the race, the eight places and the two levels. */
const Level = z.object({ name: nameText(2, 30), age: nameText(2, 30), what: nameText(2, 40) }).strict();
export const StarfishRaceConfig = z
  .object({
    title: nameText(3, 40),
    lead: safeText(1, 160),
    towns: z.array(nameText(2, 24)).length(8),
    levels: z.object({ easy: Level, hard: Level }).strict(),
  })
  .strict();
export type StarfishRaceConfig = z.infer<typeof StarfishRaceConfig>;
