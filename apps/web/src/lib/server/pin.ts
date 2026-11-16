import "server-only";
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

/** The parent PIN: 4 to 6 digits, stored only as a salted scrypt hash. */
export const isValidPin = (pin: unknown): pin is string => typeof pin === "string" && /^\d{4,6}$/.test(pin);

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(pin, salt, 32);
  return `scrypt$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function checkPin(pin: string, stored: string | undefined | null): Promise<boolean> {
  if (!stored || !isValidPin(pin)) return false;
  const [kind, saltB64, keyB64] = stored.split("$");
  if (kind !== "scrypt" || !saltB64 || !keyB64) return false;
  const key = await scrypt(pin, Buffer.from(saltB64, "base64url"), 32);
  const expected = Buffer.from(keyB64, "base64url");
  return key.length === expected.length && timingSafeEqual(key, expected);
}

export const PIN_MAX_FAILS = 5;
export const PIN_LOCK_MINUTES = 15;
