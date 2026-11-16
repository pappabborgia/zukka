import type { z } from "zod";
import { SchoolCupConfig } from "./school-cup/schema";
import { StarfishRaceConfig } from "./starfish-race/schema";

export * from "./config-block";
export * from "./text";
export * from "./school-cup/schema";
export * from "./school-cup/topics";
export * from "./school-cup/quick";
export * from "./starfish-race/schema";

/** The engines a game can be built on. Templates live in /engines/<id>/template.html. */
export interface EngineInfo {
  id: string;
  name: string;
  description: string;
  schema: z.ZodType;
  /** has a quick-creation form */
  quick: boolean;
}

export const ENGINES: Record<string, EngineInfo> = {
  "school-cup": {
    id: "school-cup",
    name: "School Cup",
    description: "A football cup: answer right to pass the ball and score. Six rounds to the trophy.",
    schema: SchoolCupConfig,
    quick: true,
  },
  "starfish-race": {
    id: "starfish-race",
    name: "Race to Starfish Bay",
    description: "A running race along the coast, with a maths question at every prize.",
    schema: StarfishRaceConfig,
    quick: false,
  },
};

export const isEngineId = (id: unknown): id is keyof typeof ENGINES => typeof id === "string" && Object.hasOwn(ENGINES, id);
