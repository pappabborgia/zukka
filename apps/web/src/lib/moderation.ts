/**
 * Small filter for words parents type that other people will see (creator nickname for now;
 * game titles and descriptions later). English, Italian and Spanish. It also refuses anything
 * that looks like an email address, a phone number or a link.
 */
const BLOCKED = [
  // English
  "ass", "arse", "bastard", "bitch", "bollocks", "boob", "cock", "crap", "cunt", "damn", "dick", "dildo", "fag",
  "fuck", "hitler", "nazi", "nigger", "nigga", "penis", "piss", "porn", "prick", "pussy", "rape", "retard",
  "sex", "shit", "slut", "tits", "twat", "vagina", "wank", "whore", "kill", "drugs", "cocaine", "weed",
  // Italian
  "cazzo", "culo", "figa", "fica", "merda", "minchia", "puttana", "troia", "stronzo", "stronza", "vaffanculo",
  "coglione", "frocio", "negro", "porco", "porca", "dio", "madonna", "bastardo", "zoccola", "mignotta",
  // Spanish
  "puta", "puto", "mierda", "joder", "coño", "cabron", "cabrón", "pendejo", "polla", "verga", "gilipollas",
  "maricon", "maricón", "follar", "culero", "chingar", "chingada",
];

/** Lowercase, strip accents and common letter swaps (4 -> a, 0 -> o, $ -> s...). */
export function normaliseForFilter(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[4@]/g, "a")
    .replace(/3/g, "e")
    .replace(/[1!|]/g, "i")
    .replace(/0/g, "o")
    .replace(/[5$]/g, "s")
    .replace(/7/g, "t");
}

export type ModerationResult = { ok: true } | { ok: false; reason: "blocked_word" | "personal_data" };

export function checkPublicText(text: string): ModerationResult {
  if (/@|https?:|www\.|\.(com|it|es|net|org|co\.uk)\b/i.test(text)) return { ok: false, reason: "personal_data" };
  if (/\d[\d\s-]{6,}\d/.test(text)) return { ok: false, reason: "personal_data" };
  const norm = normaliseForFilter(text);
  const words = norm.split(/[^a-z]+/).filter(Boolean);
  const squashed = norm.replace(/[^a-z]/g, "");
  for (const w of BLOCKED) {
    const bw = normaliseForFilter(w);
    if (words.includes(bw)) return { ok: false, reason: "blocked_word" };
    // longer words are also caught when hidden inside other letters ("xxfuckxx", "f.u.c.k")
    if (bw.length >= 4 && squashed.includes(bw)) return { ok: false, reason: "blocked_word" };
  }
  return { ok: true };
}

/** Creator nickname: 3 to 20 letters, digits, spaces, _ or -, and clean. */
export function checkCreatorNickname(raw: string): { ok: true; value: string } | { ok: false; reason: string } {
  const value = raw.trim().replace(/\s+/g, " ");
  if (value.length < 3 || value.length > 20) return { ok: false, reason: "length" };
  if (!/^[\p{L}\p{N} _-]+$/u.test(value)) return { ok: false, reason: "characters" };
  const m = checkPublicText(value);
  if (!m.ok) return { ok: false, reason: m.reason };
  return { ok: true, value };
}

/**
 * Real teams, brands and characters that belong to someone else. Not complete: the AI review
 * and the human reviewer check the rest. Matched on whole words, ignoring case and accents.
 */
const PROTECTED = [
  "real madrid", "barcelona", "barca", "fc barcelona", "juventus", "manchester united", "man utd", "man united", "manchester city",
  "man city", "liverpool", "chelsea", "arsenal", "tottenham", "spurs", "psg", "paris saint germain", "bayern", "ac milan", "inter milan",
  "as roma", "napoli", "atletico madrid", "ajax", "benfica", "borussia", "celtic", "newcastle united", "aston villa",
  "pokemon", "pikachu", "super mario", "mario kart", "luigi", "sonic", "peppa pig", "bluey", "disney", "frozen", "elsa", "olaf",
  "spider man", "spiderman", "batman", "superman", "minecraft", "fortnite", "roblox", "barbie", "paw patrol", "marvel",
  "harry potter", "hogwarts", "star wars", "lego", "minions", "shrek", "toy story", "nintendo", "playstation", "hello kitty",
  "fifa", "premier league", "champions league", "la liga", "serie a", "uefa",
];

export function checkProtectedNames(text: string): { ok: true } | { ok: false; match: string } {
  const norm = ` ${text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim()} `;
  for (const p of PROTECTED) if (norm.includes(` ${p} `)) return { ok: false, match: p };
  return { ok: true };
}
