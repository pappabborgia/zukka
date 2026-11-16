import { en, type MessageKey } from "./en";

export type Locale = "en";
const dictionaries: Record<Locale, Record<MessageKey, string>> = { en };

/** Looks up a string and fills {placeholders}. Only English for now. */
export function t(key: MessageKey, vars: Record<string, string | number> = {}, locale: Locale = "en"): string {
  const s = dictionaries[locale][key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
