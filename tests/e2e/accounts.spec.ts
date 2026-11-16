import { expect, test } from "@playwright/test";
import { addPlayer, completeWelcome, newFamily, signIn, uniqueEmail } from "./helpers";

test.skip(!!process.env.E2E_BASE_URL, "uses the Firebase emulators");

test("the catalogue is public, playing asks to sign in", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /School Cup/ })).toBeVisible();
  await page.goto("/play/school-cup");
  await expect(page.getByTestId("signin-to-play")).toBeVisible();
  await expect(page.getByTestId("game-frame")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Sign in" }).first()).toBeVisible();
});

test("a parent signs up, gives consent, adds a child, and the child plays", async ({ page }) => {
  const email = uniqueEmail();
  await signIn(page, email, "/play/school-cup");
  await completeWelcome(page);
  await page.waitForURL("**/parent/players/new?first=1");

  // the leaderboard choice has no default
  await expect(page.locator('input[name="leaderboard"]:checked')).toHaveCount(0);
  // the nickname cannot be typed: only lists
  await expect(page.getByTestId("player-form").locator('input[type="text"], textarea')).toHaveCount(0);
  const nickname = await addPlayer(page, { leaderboard: "yes", year: "y3", avatar: "owl" });
  await expect(page.getByTestId("parent-player")).toContainText("on public leaderboards");

  await page.goto("/who");
  await expect(page.getByRole("heading", { name: "Who's playing?" })).toBeVisible();
  await page.getByTestId("who-player").filter({ hasText: nickname }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/who"));
  await page.goto("/play/school-cup");
  await expect(page.getByTestId("player-chip")).toContainText(nickname);
  await expect(page.getByTestId("game-frame")).toBeVisible();

  // the parent's email is never shown on the child's pages
  for (const path of ["/", "/who", "/play/school-cup"]) {
    await page.goto(path);
    await expect(page.locator("body")).not.toContainText(email);
  }
});

test("the parent area needs the PIN once a child is playing", async ({ page }) => {
  await newFamily(page);
  await page.goto("/parent");
  await page.waitForURL("**/parent/unlock**");
  await page.locator('input[name="pin"]').fill("1111");
  await page.getByRole("button", { name: "Open" }).click();
  await expect(page.locator(".form-error")).toContainText("not right");
  await page.locator('input[name="pin"]').fill("2468");
  await page.getByRole("button", { name: "Open" }).click();
  await page.waitForURL("**/parent");
  await expect(page.getByRole("heading", { name: "Your children" })).toBeVisible();
  // the export also needs the parent area
  await page.getByRole("button", { name: /Lock and go back/ }).click();
  await page.waitForURL("**/who");
  const res = await page.request.get("/parent/export");
  expect(res.status()).toBe(403);
});

test("a family cannot see or change another family's child", async ({ browser }) => {
  const a = await browser.newPage();
  await newFamily(a);
  await a.goto("/parent");
  await a.locator('input[name="pin"]').fill("2468");
  await a.getByRole("button", { name: "Open" }).click();
  await a.waitForURL("**/parent");
  const editHref = await a.getByRole("link", { name: "Edit" }).first().getAttribute("href");

  const b = await browser.newPage();
  await signIn(b, uniqueEmail("other"));
  await completeWelcome(b);
  await b.waitForURL("**/parent/players/new?first=1");
  const res = await b.goto(editHref!);
  expect(res?.status()).toBe(404);
  await a.close();
  await b.close();
});

test("up to five children per account", async ({ page }) => {
  await signIn(page, uniqueEmail());
  await completeWelcome(page);
  await page.waitForURL("**/parent/players/new?first=1");
  for (let i = 0; i < 5; i++) {
    if (i > 0) await page.goto("/parent/players/new");
    await addPlayer(page, { leaderboard: "no" });
  }
  await expect(page.getByTestId("parent-player")).toHaveCount(5);
  await expect(page.getByRole("link", { name: /Add a player/ })).toHaveCount(0);
  await page.goto("/parent/players/new");
  await page.waitForURL("**/parent");
});

test("the parent can export and delete everything", async ({ page }) => {
  const email = uniqueEmail();
  await signIn(page, email);
  await completeWelcome(page);
  await page.waitForURL("**/parent/players/new?first=1");
  const nickname = await addPlayer(page, { leaderboard: "no" });

  await page.goto("/parent/settings");
  await page.locator('input[name="creatorNickname"]').fill("stronzo");
  await page.getByRole("button", { name: "Save nickname" }).click();
  await expect(page.getByTestId("creator-form").getByRole("alert")).toContainText("not allow");

  const exported = await page.request.get("/parent/export");
  expect(exported.status()).toBe(200);
  const data = await exported.json();
  expect(data.account.email).toBe(email);
  expect(data.players[0].nicknameText).toBe(nickname);
  expect(JSON.stringify(data)).not.toContain("scrypt");

  await page.locator('input[name="confirm"]').fill("DELETE");
  await page.getByRole("button", { name: "Delete everything" }).click();
  await page.waitForURL("**/?deleted=1");
  await expect(page.getByText("have been deleted")).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();

  // signing in again with the same email starts from scratch
  await signIn(page, email);
  await page.waitForURL("**/welcome");
});
