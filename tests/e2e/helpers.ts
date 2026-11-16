import { expect, type Page } from "@playwright/test";

export const uniqueEmail = (tag = "parent") => `${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

/** Signs in with an email link. With the emulators the link is shown on the "check your email" page. */
export async function signIn(page: Page, email: string, next?: string) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  await page.getByLabel("Your email address").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await page.waitForURL("**/login/sent");
  await page.getByTestId("dev-signin-link").click();
  await page.getByRole("button", { name: "Sign me in" }).click();
}

export async function completeWelcome(page: Page, pin = "2468") {
  await page.waitForURL("**/welcome");
  for (const box of await page.getByTestId("welcome-form").locator('input[type="checkbox"]').all()) await box.check();
  await page.locator('input[name="pin"]').fill(pin);
  await page.locator('input[name="pin2"]').fill(pin);
  await page.getByRole("button", { name: "Create my account" }).click();
}

/** Fills the player form (on /parent/players/new) and returns the nickname that was saved. */
export async function addPlayer(page: Page, opts: { leaderboard: "yes" | "no"; year?: "y2" | "y3" | "other"; avatar?: string } = { leaderboard: "no" }) {
  const nickname = (await page.getByTestId("nickname-preview").textContent())!.trim();
  if (opts.avatar) await page.locator(`input[name="avatar"][value="${opts.avatar}"]`).check({ force: true });
  await page.locator(`input[name="schoolYear"][value="${opts.year ?? "y2"}"]`).check();
  await page.locator(`input[name="leaderboard"][value="${opts.leaderboard}"]`).check();
  await page.getByRole("button", { name: /Save this player/ }).click();
  await page.waitForURL("**/parent");
  await expect(page.getByTestId("parent-player").filter({ hasText: nickname })).toBeVisible();
  return nickname;
}

/** A new parent with one child, who is now the player on this device. */
export async function newFamily(page: Page) {
  const email = uniqueEmail();
  await signIn(page, email);
  await completeWelcome(page);
  await page.waitForURL("**/parent/players/new?first=1");
  const nickname = await addPlayer(page, { leaderboard: "no" });
  await page.goto("/who");
  await page.getByTestId("who-player").filter({ hasText: nickname }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/who"));
  return { email, nickname };
}
