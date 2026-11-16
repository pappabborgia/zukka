import { expect, test, type Page } from "@playwright/test";
import { addPlayer, completeWelcome, signIn, uniqueEmail } from "./helpers";

test.skip(!!process.env.E2E_BASE_URL, "uses the Firebase emulators");

async function newParentInStudio(page: Page) {
  await signIn(page, uniqueEmail("studio"));
  await completeWelcome(page);
  await page.waitForURL("**/parent/players/new?first=1");
  await addPlayer(page, { leaderboard: "no" });
  await page.getByRole("link", { name: /Studio/ }).click();
  await page.waitForURL("**/studio");
}

async function fillQuickForm(page: Page, o: { title: string; team: string; subject?: string; year?: string; topics: string[]; tables?: string[] }) {
  const f = page.getByTestId("quick-form");
  await f.getByLabel("Name of the game").fill(o.title);
  await f.getByLabel("Name of the tournament").fill("Rainbow Trophy");
  await f.getByLabel("Name of your team").fill(o.team);
  await f.locator('input[name="colour1"][value="#2f9e44"]').check({ force: true });
  await f.locator('input[name="colour2"][value="#ffffff"]').check({ force: true });
  await f.locator('input[name="pattern"][value="hoops"]').check();
  await f.locator(`input[name="subject"][value="${o.subject ?? "maths"}"]`).check();
  await f.locator(`input[name="year"][value="${o.year ?? "3"}"]`).check();
  for (const t of o.topics) await f.locator(`input[name="topics"][value="${t}"]`).check();
  for (const n of o.tables ?? []) await f.locator(`input[name="tables"][value="${n}"]`).check();
}

test("a parent creates a game from the School Cup template, plays it and makes a new version", async ({ page }) => {
  await newParentInStudio(page);
  await expect(page.getByText("You have not made any games yet")).toBeVisible();
  await page.getByRole("link", { name: /New game/ }).click();
  await page.getByTestId("template-card").filter({ hasText: "School Cup" }).click();

  await fillQuickForm(page, { title: "Green Owls Cup", team: "Green Owls", topics: ["times-tables", "borrowing"], tables: ["6", "7"] });
  await expect(page.getByTestId("shield-preview")).toContainText("GO");
  await page.getByRole("button", { name: "Create the game" }).click();
  await page.waitForURL(/\/studio\/games\/[A-Za-z0-9]+$/);
  await expect(page.getByTestId("studio-game-title")).toHaveText("Green Owls Cup");

  // the preview is the real game, served by the games origin from the saved version
  const game = page.frameLocator('[data-testid="game-frame"]');
  await game.locator('#dev [data-dev="laptop"]').click();
  await expect(game.locator("#heroTitle")).toHaveText("GREEN OWLS CUP");
  await expect(game.locator("#tours")).toContainText("Rainbow Trophy");
  await expect(game.locator("#subs")).toContainText("Maths");
  await expect(game.locator("#subs")).not.toContainText("Reading");
  await expect(game.locator("#yearSeg button")).toHaveCount(1);
  await expect(game.locator("#myName")).toContainText("Green Owls");
  await game.locator("#playBtn").click();
  await expect(page.getByTestId("host-events")).toContainText("game_started", { timeout: 20_000 });
  await expect(game.locator("#q")).toContainText(/×|−|\d/, { timeout: 20_000 });

  // a new version from the form
  await page.getByRole("link", { name: /Change it/ }).click();
  await expect(page.getByTestId("quick-form").getByLabel("Name of the game")).toHaveValue("Green Owls Cup");
  await page.getByTestId("quick-form").getByLabel("Name of the game").fill("Green Owls Spelling Cup");
  await page.locator('input[name="subject"][value="writing"]').check();
  await page.locator('input[name="year"][value="2"]').check();
  await page.locator('input[name="topics"][value="W2-0"]').check();
  await page.getByRole("button", { name: "Save a new version" }).click();
  await page.waitForURL(/\/studio\/games\/[A-Za-z0-9]+$/);
  await expect(page.getByTestId("studio-game-title")).toHaveText("Green Owls Spelling Cup");
  await expect(page.getByTestId("versions").locator("li")).toHaveCount(2);
  await expect(page.frameLocator('[data-testid="game-frame"]').locator("#subs")).toContainText("Writing");

  // back to version 1
  await page.getByRole("button", { name: "Go back to this version" }).click();
  await expect(page.getByTestId("studio-game-title")).toHaveText("Green Owls Cup");

  // the game is in the list, as a draft
  await page.goto("/studio");
  await expect(page.getByTestId("studio-game")).toContainText("Draft");
});

test("real team names are refused with a clear message", async ({ page }) => {
  await newParentInStudio(page);
  await page.goto("/studio/new/school-cup");
  await fillQuickForm(page, { title: "Super Cup", team: "Real Madrid", topics: ["borrowing"] });
  await page.getByRole("button", { name: "Create the game" }).click();
  await expect(page.getByTestId("quick-form").locator(".form-error")).toContainText("belongs to someone else");
});

test("Make your own version starts from a catalogue game and keeps the link", async ({ page }) => {
  await newParentInStudio(page);
  await page.goto("/studio/new");
  await page.getByTestId("remix-card").filter({ hasText: "School Cup" }).click();
  await expect(page.getByRole("heading", { name: "Your own version of School Cup" })).toBeVisible();
  await fillQuickForm(page, { title: "Our Reading Cup", team: "Book Badgers", subject: "reading", year: "2", topics: ["R2-0", "R2-3"] });
  await page.getByRole("button", { name: "Create the game" }).click();
  await page.waitForURL(/\/studio\/games\/[A-Za-z0-9]+$/);
  await expect(page.getByText("your own version of School Cup")).toBeVisible();
});

test("the Studio is behind the parent PIN", async ({ page }) => {
  await signIn(page, uniqueEmail("pin"));
  await completeWelcome(page);
  await page.waitForURL("**/parent/players/new?first=1");
  const nickname = await addPlayer(page, { leaderboard: "no" });
  await page.goto("/who");
  await page.getByTestId("who-player").filter({ hasText: nickname }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/who"));
  await page.goto("/studio");
  await page.waitForURL("**/parent/unlock**");
});
