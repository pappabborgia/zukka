"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AccountError,
  createAccount,
  createPlayer,
  deleteAccount,
  deletePlayer,
  getPlayer,
  setCreatorNickname,
  setPin,
  updatePlayer,
  verifyPin,
} from "@/lib/server/accounts";
import { clientIp, requireAccount, requireParent, safeNext } from "@/lib/server/guards";
import { hit, LIMITS } from "@/lib/server/rate-limit";
import { currentUid, endSession, lockParentArea, setCurrentPlayer, unlockParentArea, clearCurrentPlayer } from "@/lib/server/session";
import type { FormState } from "./auth";

const MESSAGES: Record<string, string> = {
  invalid: "Please check the form: something is missing or not valid.",
  too_many_players: "An account can have up to 5 player profiles.",
  nickname_taken: "Another player already has this nickname. Change the number or a word.",
  not_found: "This profile does not exist any more.",
  wrong_pin: "That PIN is not right.",
  pin_locked: "Too many wrong tries. The PIN is locked for 15 minutes; you can also sign in again with an email link.",
  blocked_word: "That nickname contains a word we do not allow. Please choose another.",
  personal_data: "Please do not put emails, phone numbers or links in a nickname.",
  already_exists: "Your account is already set up.",
  no_account: "Please finish setting up your account first.",
};
const message = (e: unknown) => (e instanceof AccountError ? (MESSAGES[e.code] ?? MESSAGES.invalid) : "Something went wrong. Please try again.");

/* ---------- first visit: consent and PIN ---------- */

export async function completeSignup(_prev: FormState, form: FormData): Promise<FormState> {
  const uid = await currentUid();
  if (!uid) redirect("/login");
  const pin = String(form.get("pin") ?? "");
  if (pin !== String(form.get("pin2") ?? "")) return { error: "The two PINs are not the same." };
  try {
    await createAccount(uid, {
      adult: form.get("adult") === "on",
      childProfiles: form.get("childProfiles") === "on",
      policies: form.get("policies") === "on",
      pin,
    });
  } catch (e) {
    if (e instanceof AccountError && e.code === "already_exists") redirect("/who");
    if (e instanceof AccountError && e.code === "invalid")
      return { error: "Please tick all three boxes and choose a PIN of 4 to 6 digits." };
    return { error: message(e) };
  }
  await unlockParentArea(uid);
  redirect("/parent/players/new?first=1");
}

/* ---------- parent area lock ---------- */

export async function unlockWithPin(_prev: FormState, form: FormData): Promise<FormState> {
  const acc = await requireAccount("/parent");
  if (!(await hit("pin-ip", await clientIp(), LIMITS.pinPerIp.limit, LIMITS.pinPerIp.windowSeconds)))
    return { error: "Too many attempts from this connection. Please try again later." };
  try {
    await verifyPin(acc.uid, String(form.get("pin") ?? ""));
  } catch (e) {
    return { error: message(e) };
  }
  await unlockParentArea(acc.uid);
  redirect(safeNext(form.get("next"), "/parent"));
}

export async function lockAndLeave(): Promise<void> {
  await lockParentArea();
  redirect("/who");
}

/* ---------- who is playing ---------- */

export async function choosePlayer(form: FormData): Promise<void> {
  const acc = await requireAccount("/who");
  const pid = String(form.get("playerId") ?? "");
  const player = await getPlayer(acc.uid, pid);
  if (!player) redirect("/who");
  await setCurrentPlayer(acc.uid, player.id);
  await lockParentArea(); // a child is now using the device
  redirect(safeNext(form.get("next"), "/"));
}

/* ---------- player profiles (parent area) ---------- */

function playerFromForm(form: FormData) {
  const lb = form.get("leaderboard");
  return {
    nickname: {
      adjective: String(form.get("adjective") ?? ""),
      animal: String(form.get("animal") ?? ""),
      number: Number(form.get("number")),
    },
    avatar: String(form.get("avatar") ?? ""),
    schoolYear: String(form.get("schoolYear") ?? ""),
    // an explicit choice is required: no default
    showOnLeaderboards: lb === "yes" ? true : lb === "no" ? false : undefined,
  };
}

export async function savePlayer(_prev: FormState, form: FormData): Promise<FormState> {
  const acc = await requireParent("/parent");
  const input = playerFromForm(form);
  if (input.showOnLeaderboards === undefined) return { error: "Please choose whether this profile appears on the public leaderboards." };
  const id = String(form.get("playerId") ?? "");
  try {
    if (id) await updatePlayer(acc.uid, id, input);
    else await createPlayer(acc.uid, input);
  } catch (e) {
    return { error: message(e) };
  }
  revalidatePath("/parent");
  redirect("/parent");
}

export async function removePlayer(form: FormData): Promise<void> {
  const acc = await requireParent("/parent");
  try {
    await deletePlayer(acc.uid, String(form.get("playerId") ?? ""));
  } catch {
    // already gone
  }
  await clearCurrentPlayer();
  revalidatePath("/parent");
  redirect("/parent");
}

/* ---------- settings ---------- */

export async function saveCreatorNickname(_prev: FormState, form: FormData): Promise<FormState> {
  const acc = await requireParent("/parent/settings");
  try {
    await setCreatorNickname(acc.uid, String(form.get("creatorNickname") ?? ""));
  } catch (e) {
    if (e instanceof AccountError && e.code === "invalid")
      return { error: "Use 3 to 20 letters, numbers, spaces, - or _." };
    return { error: message(e) };
  }
  revalidatePath("/parent/settings");
  return { ok: true };
}

export async function changePin(_prev: FormState, form: FormData): Promise<FormState> {
  const acc = await requireParent("/parent/settings");
  const pin = String(form.get("pin") ?? "");
  if (pin !== String(form.get("pin2") ?? "")) return { error: "The two PINs are not the same." };
  try {
    await setPin(acc.uid, pin);
  } catch {
    return { error: "The PIN must be 4 to 6 digits." };
  }
  return { ok: true };
}

export async function deleteMyAccount(_prev: FormState, form: FormData): Promise<FormState> {
  const acc = await requireParent("/parent/settings");
  if (String(form.get("confirm") ?? "").trim() !== "DELETE") return { error: "Type DELETE in capital letters to confirm." };
  await deleteAccount(acc.uid);
  await endSession();
  redirect("/?deleted=1");
}
