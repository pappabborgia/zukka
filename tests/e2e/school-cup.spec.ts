import { expect, test, type FrameLocator } from "@playwright/test";

/** Clicks through one School Cup match, choosing the first answer button each time. */
async function playOneMatch(game: FrameLocator, page: import("@playwright/test").Page) {
  const deadline = Date.now() + 200_000;
  while (Date.now() < deadline) {
    if (await game.locator("#over.on #box h2").isVisible().catch(() => false)) {
      const txt = (await game.locator("#over.on #box").textContent()) ?? "";
      if (/Correct answers|correct/i.test(txt)) return;
    }
    const typed = game.locator("#tin:not([disabled])");
    if (await typed.isVisible().catch(() => false)) {
      await typed.fill("zukka");
      await game.locator("#tgo").click({ timeout: 2000 }).catch(() => {});
      continue;
    }
    const pad = game.locator("#pyes, #pdone");
    if (await pad.first().isVisible().catch(() => false)) {
      await pad.first().click({ timeout: 2000 }).catch(() => {});
      continue;
    }
    const btn = game.locator("#ans button:not([disabled])").first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click({ timeout: 2000 }).catch(() => {});
    } else {
      await page.waitForTimeout(250);
    }
  }
  throw new Error("match did not finish in time");
}

test("School Cup runs in the sandbox and reports a whole match", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/play/school-cup?debug=1");
  const game = page.frameLocator('[data-testid="game-frame"]');

  // first visit: choose the device, then Year 2 and the first cup round
  await game.locator('#dev [data-dev="laptop"]').click();
  await game.locator('#yearSeg [data-year="2"]').click();
  await expect(game.locator("h1")).toContainText("SCHOOL");
  await expect(game.locator("#tours")).toContainText("Pirate Ship Cup");
  await expect(game.locator("body")).not.toContainText(/Enzo|Leo|BCG|Barcelona|Real Madrid|Roma\b/);

  await game.locator("#playBtn").click();
  await playOneMatch(game, page);

  const events = page.getByTestId("host-events");
  await expect(events).toContainText("game_started");
  await expect(events).toContainText("game_completed");
  const lines = await events.locator("li").allTextContents();
  const answers = lines.filter((l) => l.startsWith("answer:")).length;
  const done = lines.find((l) => l.startsWith("game_completed"))!;
  const [, correct, total] = done.match(/(\d+)\/(\d+)/)!.map(Number);
  expect(total).toBe(answers);
  expect(correct).toBeLessThanOrEqual(total);
  expect(total).toBeGreaterThanOrEqual(10);
  expect(lines.some((l) => l.startsWith("flags"))).toBe(false);
  await expect(page.getByTestId("play-summary")).toContainText(`${correct} correct out of ${total}`);
  expect(errors).toEqual([]);
});
