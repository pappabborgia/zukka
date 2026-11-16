import { expect, test, type Page, type Request } from "@playwright/test";

const LOCAL = /^(https?:\/\/(localhost:3000|127\.0\.0\.1:3001)\/|data:|blob:|about:|chrome-error:)/;

/**
 * Records every request that would actually leave the two local origins (and aborts it).
 * Requests refused by the Content Security Policy never reach the network layer, so they
 * do not appear here; Chromium still lists them in DevTools as "(blocked:csp)".
 */
async function trapOutsideRequests(page: Page): Promise<string[]> {
  const outside: string[] = [];
  await page.context().route("**/*", (route) => {
    const url = route.request().url();
    if (LOCAL.test(url)) return route.continue();
    outside.push(url);
    return route.abort();
  });
  page.on("requestfinished", (r: Request) => {
    if (!LOCAL.test(r.url())) outside.push("finished: " + r.url());
  });
  return outside;
}

test("the probe game cannot reach the network, storage or the page around it", async ({ page }) => {
  const outside = await trapOutsideRequests(page);
  // a cookie on the main site that the game must never read
  await page.context().addCookies([{ name: "main_secret", value: "s3cret", url: "http://localhost:3000" }]);
  await page.goto("/dev/sandbox-check");
  const probe = page.getByTestId("probe-results").first();
  await expect(probe).toBeVisible({ timeout: 60_000 });

  const rows = await probe.locator("tr").evaluateAll((trs) =>
    trs.map((tr) => ({ kind: tr.getAttribute("data-kind"), text: tr.textContent })),
  );
  const notBlocked = rows.filter((r) => r.kind === "NOT BLOCKED");
  expect(rows.length).toBeGreaterThan(20);
  expect(notBlocked, JSON.stringify(notBlocked)).toEqual([]);
  // the important checks are all present
  for (const name of ["Read cookies", "Read localStorage", "fetch() to another site", "WebSocket", "External image", "Open a popup", "Navigate the main page", "Run eval()"]) {
    expect(rows.some((r) => r.text?.includes(name) && r.kind === "blocked"), name).toBe(true);
  }
  await page.waitForTimeout(1500);
  expect(outside, "requests that left the sandbox").toEqual([]);
});

test("a game cannot navigate its own frame to another website", async ({ page }) => {
  const outside = await trapOutsideRequests(page);
  await page.goto("/dev/sandbox-check");
  await expect(page.getByTestId("probe-loads").nth(1)).toContainText("tried to navigate", { timeout: 30_000 });
  await page.waitForTimeout(2500);
  expect(outside.filter((u) => u.includes("example.com")), "navigation left the games origin").toEqual([]);
  // the navigate probe frame did not end up on example.com
  const frameUrls = page.frames().map((f) => f.url());
  expect(frameUrls.some((u) => u.includes("example.com"))).toBe(false);
});

test("game documents carry the isolation headers, also when opened directly", async ({ request }) => {
  const r = await request.get("http://127.0.0.1:3001/g/school-cup");
  expect(r.status()).toBe(200);
  const csp = r.headers()["content-security-policy"];
  expect(csp).toContain("default-src 'none'");
  expect(csp).toContain("connect-src 'none'");
  expect(csp).toContain("sandbox allow-scripts");
  expect(csp).toContain("frame-ancestors http://localhost:3000");
  expect(r.headers()["x-content-type-options"]).toBe("nosniff");
  expect(r.headers()["set-cookie"]).toBeUndefined();

  const missing = await request.get("http://127.0.0.1:3001/g/does-not-exist");
  expect(missing.status()).toBe(404);
});

test("the games origin refuses to be framed by any other page", async ({ page }) => {
  await page.goto("about:blank");
  await page.setContent(`<iframe id="f" src="http://127.0.0.1:3001/g/school-cup" style="width:600px;height:400px"></iframe>`, { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(3000);
  const child = page.frames().find((f) => f !== page.mainFrame());
  const hasGame = child ? await child.locator("#playBtn").count().catch(() => 0) : 0;
  expect(hasGame, "the game rendered inside a page that is not Zukka").toBe(0);
});

test("control: the network trap does catch requests when nothing blocks them", async ({ page }) => {
  const outside = await trapOutsideRequests(page);
  await page.goto("about:blank");
  await page.setContent(`<img src="https://example.com/control.png">`);
  await page.waitForTimeout(1000);
  expect(outside).toContain("https://example.com/control.png");
});
