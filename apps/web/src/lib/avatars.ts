/** The avatar gallery. A child picks one; no photos, ever. */
export const AVATARS = [
  { id: "fox", emoji: "🦊", bg: "#ffe0c2" },
  { id: "panda", emoji: "🐼", bg: "#e6e6f0" },
  { id: "lion", emoji: "🦁", bg: "#ffe9a8" },
  { id: "tiger", emoji: "🐯", bg: "#ffd8a8" },
  { id: "frog", emoji: "🐸", bg: "#d3f9d8" },
  { id: "owl", emoji: "🦉", bg: "#e9dccf" },
  { id: "penguin", emoji: "🐧", bg: "#d0ebff" },
  { id: "koala", emoji: "🐨", bg: "#e9ecef" },
  { id: "unicorn", emoji: "🦄", bg: "#f3d9fa" },
  { id: "dragon", emoji: "🐲", bg: "#c3fae8" },
  { id: "octopus", emoji: "🐙", bg: "#ffdeeb" },
  { id: "turtle", emoji: "🐢", bg: "#d8f5a2" },
  { id: "bee", emoji: "🐝", bg: "#fff3bf" },
  { id: "dolphin", emoji: "🐬", bg: "#c5f6fa" },
  { id: "rabbit", emoji: "🐰", bg: "#fff0f6" },
  { id: "cat", emoji: "🐱", bg: "#fff4e6" },
  { id: "dog", emoji: "🐶", bg: "#f8f0e3" },
  { id: "monkey", emoji: "🐵", bg: "#f1e3d3" },
  { id: "bear", emoji: "🐻", bg: "#ead7c3" },
  { id: "whale", emoji: "🐳", bg: "#d0ebff" },
  { id: "hedgehog", emoji: "🦔", bg: "#ece0d1" },
  { id: "parrot", emoji: "🦜", bg: "#d3f9d8" },
  { id: "dino", emoji: "🦕", bg: "#e6fcf5" },
  { id: "rocket", emoji: "🚀", bg: "#e5dbff" },
] as const;

export type AvatarId = (typeof AVATARS)[number]["id"];
export const isAvatarId = (v: unknown): v is AvatarId => typeof v === "string" && AVATARS.some((a) => a.id === v);
export const avatarOf = (id: string) => AVATARS.find((a) => a.id === id) ?? AVATARS[0];
