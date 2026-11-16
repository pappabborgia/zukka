/**
 * Child nicknames are built only from these lists (adjective + animal + number), never typed,
 * so they cannot contain a real name or an unsuitable word. Every word here was chosen by hand.
 */
export const ADJECTIVES = [
  "Brave", "Bouncy", "Bright", "Bubbly", "Calm", "Cheery", "Clever", "Cosmic", "Cosy", "Curious",
  "Dazzling", "Dreamy", "Eager", "Fizzy", "Fluffy", "Friendly", "Funny", "Gentle", "Giggly", "Glowing",
  "Golden", "Happy", "Jolly", "Kind", "Lively", "Lucky", "Magic", "Merry", "Mighty", "Nimble",
  "Peppy", "Plucky", "Quick", "Quiet", "Rapid", "Shiny", "Silly", "Sparkly", "Speedy", "Sunny",
  "Super", "Swift", "Tiny", "Twinkly", "Witty", "Zippy",
] as const;

export const ANIMALS = [
  "Badger", "Bear", "Bee", "Beaver", "Bunny", "Butterfly", "Camel", "Cat", "Cheetah", "Chick",
  "Dolphin", "Dragon", "Duck", "Eagle", "Elephant", "Ferret", "Flamingo", "Fox", "Frog", "Gecko",
  "Giraffe", "Goat", "Hamster", "Hedgehog", "Hippo", "Koala", "Ladybird", "Lemur", "Lion", "Llama",
  "Meerkat", "Monkey", "Moose", "Narwhal", "Otter", "Owl", "Panda", "Parrot", "Penguin", "Pony",
  "Puffin", "Rabbit", "Raccoon", "Robin", "Seal", "Sloth", "Squirrel", "Tiger", "Turtle", "Unicorn",
  "Walrus", "Whale", "Wombat", "Yak", "Zebra",
] as const;

export const NICKNAME_NUMBER_MIN = 1;
export const NICKNAME_NUMBER_MAX = 99;

export type Adjective = (typeof ADJECTIVES)[number];
export type Animal = (typeof ANIMALS)[number];
export interface NicknameParts {
  adjective: Adjective;
  animal: Animal;
  number: number;
}

export function isNicknameParts(v: unknown): v is NicknameParts {
  if (!v || typeof v !== "object") return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.adjective === "string" &&
    (ADJECTIVES as readonly string[]).includes(p.adjective) &&
    typeof p.animal === "string" &&
    (ANIMALS as readonly string[]).includes(p.animal) &&
    Number.isInteger(p.number) &&
    (p.number as number) >= NICKNAME_NUMBER_MIN &&
    (p.number as number) <= NICKNAME_NUMBER_MAX
  );
}

/** "SunnyOtter42" */
export function nicknameText(p: NicknameParts): string {
  return `${p.adjective}${p.animal}${p.number}`;
}

/** Key used to keep nicknames unique across the whole platform. */
export function nicknameKey(p: NicknameParts): string {
  return nicknameText(p).toLowerCase();
}

export function randomNickname(rand: () => number = Math.random): NicknameParts {
  const pick = <T,>(a: readonly T[]) => a[Math.floor(rand() * a.length)];
  return {
    adjective: pick(ADJECTIVES),
    animal: pick(ANIMALS),
    number: NICKNAME_NUMBER_MIN + Math.floor(rand() * (NICKNAME_NUMBER_MAX - NICKNAME_NUMBER_MIN + 1)),
  };
}
