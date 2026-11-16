/** English strings. Add it.ts / es.ts with the same keys to translate. */
export const en = {
  "site.tagline": "Learning games for 6 to 9 year olds, made by parents",
  "site.preview": "Preview: phase 1",
  "home.title": "Games",
  "home.play": "Play",
  "home.years": "Years {years}",
  "subject.maths": "Maths",
  "subject.reading": "Reading",
  "subject.writing": "Writing",
  "subject.other": "Other",
  "play.back": "All games",
  "play.loading": "Loading the game…",
  "play.notFound": "We could not find this game.",
  "play.summary.title": "Well played!",
  "play.summary.correct": "{correct} correct out of {total}",
  "play.summary.time": "Time: {time}",
  "play.summary.points": "Zukka points will be added here soon.",
  "play.summary.again": "Play again",
  "play.debug.title": "Messages from the game",
  "check.title": "Sandbox check",
} as const;

export type MessageKey = keyof typeof en;
