import { expect, test, type FrameLocator, type Page } from "@playwright/test";

/** Clicks through one School Cup match. Wrong or right does not matter: the events are what we check. */
async function playOneMatch(game: FrameLocator, page: Page) {
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
    const pad = game.locator("#pad");
    if (await pad.isVisible().catch(() => false)) {
      // write something on the handwriting pad, then say it is right
      const box = await pad.boundingBox();
      if (box) {
        await page.mouse.move(box.x + 20, box.y + 40);
        await page.mouse.down();
        await page.mouse.move(box.x + 120, box.y + 80);
        await page.mouse.up();
      }
      await game.locator("#pdone").click({ timeout: 2000 }).catch(() => {});
      await game.locator("#pyes").click({ timeout: 2000 }).catch(() => {});
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

async function startCupMatch(page: Page, opts: { device: "ipad" | "laptop"; year: 2 | 3; subject: string }) {
  await page.goto("/play/school-cup?debug=1");
  const game = page.frameLocator('[data-testid="game-frame"]');
  await game.locator(`#dev [data-dev="${opts.device}"]`).click();
  await game.locator(`#yearSeg [data-year="${opts.year}"]`).click();
  await game.locator("#subs button", { hasText: opts.subject }).click();
  await game.locator("#playBtn").click();
  return game;
}

async function hostEvents(page: Page) {
  const events = page.getByTestId("host-events");
  await expect(events).toContainText("game_completed", { timeout: 30_000 });
  const lines = await events.locator("li").allTextContents();
  const answers = lines.filter((l) => l.startsWith("answer:"));
  const done = lines.find((l) => l.startsWith("game_completed"))!;
  const [, correct, total] = done.match(/(\d+)\/(\d+)/)!.map(Number);
  return { lines, answers, correct, total };
}

test("School Cup: the menu has made-up teams only", async ({ page }) => {
  await page.goto("/play/school-cup");
  const game = page.frameLocator('[data-testid="game-frame"]');
  await game.locator('#dev [data-dev="laptop"]').click();
  await expect(game.locator("h1")).toContainText("SCHOOL");
  await expect(game.locator("#tours")).toContainText("Pirate Ship Cup");
  await expect(game.locator("body")).not.toContainText(/Enzo|Leo\b|BCG|Barcelona|Real Madrid|Roma\b/);
});

test("School Cup: a maths match reports started, every answer and completed", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const game = await startCupMatch(page, { device: "laptop", year: 2, subject: "Maths" });
  await playOneMatch(game, page);
  const { lines, answers, correct, total } = await hostEvents(page);
  expect(lines[0]).toBe("game_started");
  expect(total).toBe(answers.length);
  expect(total).toBe(18); // a cup match is 90 minutes, one question every 5
  expect(correct).toBe(answers.filter((a) => a.endsWith("correct")).length);
  expect(lines.some((l) => l.startsWith("flags"))).toBe(false);
  await expect(page.getByTestId("play-summary")).toContainText(`${correct} correct out of ${total}`);
  expect(errors).toEqual([]);
});

test("School Cup: handwriting is an exercise only and is never reported", async ({ page }) => {
  const game = await startCupMatch(page, { device: "ipad", year: 3, subject: "Writing" });
  await playOneMatch(game, page);
  const { answers, total } = await hostEvents(page);
  expect(total).toBe(answers.length);
  // 18 questions, at most 3 of them written by hand: those send no answer event
  expect(total).toBeGreaterThanOrEqual(15);
  expect(total).toBeLessThanOrEqual(18);
});

test("School Cup: Phonics is listen-and-choose and appears only with a local voice", async ({ page }) => {
  // without voices, no Phonics
  await page.goto("/play/school-cup");
  let game = page.frameLocator('[data-testid="game-frame"]');
  await game.locator('#dev [data-dev="laptop"]').click();
  await expect(game.locator("#subs")).not.toContainText("Phonics");

  // with a (fake) local voice, in every frame
  await page.addInitScript(() => {
    const v = { name: "Test voice", lang: "en-GB", localService: true, voiceURI: "test", default: true };
    try {
      speechSynthesis.getVoices = () => [v as SpeechSynthesisVoice];
      speechSynthesis.speak = () => {};
    } catch {}
  });
  game = await startCupMatch(page, { device: "laptop", year: 2, subject: "Phonics" });
  await expect(game.locator("#q")).toContainText("Listen!", { timeout: 20_000 });
  await playOneMatch(game, page);
  const { answers, total } = await hostEvents(page);
  expect(total).toBe(18);
  expect(answers.length).toBe(18);
});
