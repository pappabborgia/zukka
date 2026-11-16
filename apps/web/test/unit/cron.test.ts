import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/server/rate-limit", () => ({ deleteExpiredRateLimits: vi.fn(async () => 7) }));
const { GET } = await import("../../src/app/api/cron/nightly/route");

const ENV = { ...process.env };
afterEach(() => {
  process.env = { ...ENV };
});
const call = (auth?: string) => GET(new Request("http://localhost/api/cron/nightly", { headers: auth ? { authorization: auth } : {} }));

describe("nightly job", () => {
  it("refuses everything when CRON_SECRET is not set", async () => {
    delete process.env.CRON_SECRET;
    expect((await call("Bearer ")).status).toBe(401);
    expect((await call()).status).toBe(401);
  });
  it("refuses a wrong secret", async () => {
    process.env.CRON_SECRET = "a-long-enough-cron-secret";
    expect((await call("Bearer nope")).status).toBe(401);
  });
  it("runs with the right secret", async () => {
    process.env.CRON_SECRET = "a-long-enough-cron-secret";
    const res = await call("Bearer a-long-enough-cron-secret");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, rateLimitsDeleted: 7 });
  });
});
