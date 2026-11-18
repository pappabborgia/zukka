import { expect, test, type Page } from "@playwright/test";
import { addPlayer, completeWelcome, signIn, uniqueEmail } from "./helpers";

test.skip(!!process.env.E2E_BASE_URL, "uses the Firebase emulators and the stand-in AI");

async function parentInStudio(page: Page) {
  await signIn(page, uniqueEmail("free"));
  await completeWelcome(page);
  await page.waitForURL("**/parent/players/new?first=1");
  await addPlayer(page, { leaderboard: "no" });
}

test("a parent describes a game in five steps, the AI builds it, it plays, and a change makes a new version", async ({ page }) => {
  await parentInStudio(page);
  await page.goto("/studio/new");
  await page.getByTestId("free-card").click();
  const w = page.getByTestId("free-wizard");

  // step 1: nothing filled in -> a clear hint, no moving on
  await w.getByRole("button", { name: "Next →" }).click();
  await expect(w.getByRole("alert")).toContainText("Give your game a name");
  await w.getByLabel("Name of the game").fill("Star Catcher");
  await w.locator('input[name="gameType"][value="catch"]').check({ force: true });
  await w.getByLabel("What is the game about, and what is the goal?").fill("Stars fall from the sky. Catch the star with the right answer to fill the rocket.");
  await w.getByRole("button", { name: "Next →" }).click();

  // step 2
  await expect(w.locator('[data-step="2"]')).toBeVisible();
  await w.locator('input[name="subject"][value="maths"]').check();
  await w.locator('input[name="year"][value="2"]').check();
  await w.getByRole("button", { name: "Next →" }).click();
  await expect(w.getByRole("alert")).toContainText("at least one topic");
  await w.locator('input[name="topics"][value="facts-20"]').check();
  await w.getByRole("button", { name: "Next →" }).click();

  // step 3
  await w.locator('input[name="setting"][value="space"]').check({ force: true });
  await w.getByLabel("The main character (optional)").fill("A little rocket called Zoom");
  await w.getByRole("button", { name: "Next →" }).click();

  // step 4: the defaults are fine, change one
  await w.locator('input[name="levels"][value="5"]').check();
  await w.getByRole("button", { name: "Next →" }).click();

  // step 5: the summary shows the answers
  const summary = page.getByTestId("wizard-summary");
  await expect(summary).toContainText("Star Catcher");
  await expect(summary).toContainText("Catch and collect");
  await expect(summary).toContainText("Number facts to 20");
  await expect(summary).toContainText("A little rocket called Zoom");
  await expect(summary).toContainText("5 levels");
  // going back keeps the answers
  await w.getByRole("button", { name: "← Back" }).click();
  await expect(w.locator('input[name="levels"][value="5"]')).toBeChecked();
  await w.getByRole("button", { name: "Next →" }).click();
  await w.getByLabel("My game follows these rules.").check();
  await w.getByRole("button", { name: "✨ Create my game" }).click();

  await page.waitForURL(/\/studio\/games\/[A-Za-z0-9]+$/);
  await expect(page.getByTestId("studio-game-title")).toHaveText("Star Catcher");
  // the AI works in the background; the page refreshes by itself until the game is there
  const game = page.frameLocator('[data-testid="game-frame"]');
  await expect(game.locator("#title")).toHaveText("Star Catcher", { timeout: 20_000 });
  await expect(page.getByTestId("ai-working")).toHaveCount(0);

  // it plays and reports to Zukka
  await game.locator("#start").click();
  for (let i = 0; i < 5; i++) await game.locator("button.opt").first().click();
  await expect(page.getByTestId("host-events")).toContainText("game_completed");

  // a change, using a suggestion
  await page.getByTestId("change-box").getByRole("button", { name: "Make it a little easier" }).click();
  await expect(page.getByTestId("change-box").locator("textarea")).toHaveValue("Make it a little easier");
  await page.getByRole("button", { name: "✨ Change my game" }).click();
  await expect(page.getByTestId("versions").locator("li")).toHaveCount(2, { timeout: 20_000 });
  await expect(page.frameLocator('[data-testid="game-frame"]').locator("#title")).toContainText("Make it a little", { timeout: 20_000 });

  // back to version 1
  await page.getByRole("button", { name: "Go back to this version" }).click();
  await expect(page.frameLocator('[data-testid="game-frame"]').locator("#title")).toHaveText("Star Catcher");
});

test("Make your own version of Race to Starfish Bay starts from a copy", async ({ page }) => {
  await parentInStudio(page);
  await page.goto("/studio/new");
  await page.getByTestId("remix-card").filter({ hasText: "Race to Starfish Bay" }).click();
  await expect(page.getByRole("heading", { name: "Your own version of Race to Starfish Bay" })).toBeVisible();
  await page.getByLabel("Name of your version").fill("Our Seaside Race");
  await page.getByRole("button", { name: "Make my copy" }).click();
  await page.waitForURL(/\/studio\/games\/[A-Za-z0-9]+$/);
  await expect(page.getByTestId("studio-game-title")).toHaveText("Our Seaside Race");
  await expect(page.locator("p.hint").getByText("your own version of Race to Starfish Bay")).toBeVisible();
  await expect(page.frameLocator('[data-testid="game-frame"]').locator("#title")).toHaveText("Race to Starfish Bay");
  await expect(page.getByTestId("versions")).toContainText("Copied from the original game");
  await expect(page.getByTestId("change-box")).toBeVisible();
});
