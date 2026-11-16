import { afterEach, describe, expect, it, vi } from "vitest";
import { devMailMode, mailerConfigured, sendEmail, signInEmail } from "../../src/lib/server/mailer";

const ENV = { ...process.env };
afterEach(() => {
  process.env = { ...ENV };
  vi.unstubAllGlobals();
});

describe("mailer (Resend)", () => {
  it("sends the sign-in email through the Resend API", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "Zukka <login@zukka.example>";
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await sendEmail(signInEmail("parent@example.com", "https://zukka-gules.vercel.app/auth/finish?oobCode=abc&next=%2F"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_test");
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ from: "Zukka <login@zukka.example>", to: ["parent@example.com"], subject: "Your Zukka sign-in link" });
    expect(body.text).toContain("oobCode=abc");
    expect(body.html).toContain("oobCode=abc&amp;next");
  });

  it("fails loudly when Resend refuses", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "x@zukka.example";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 403 })));
    await expect(sendEmail(signInEmail("a@example.com", "https://x/"))).rejects.toThrow("403");
  });

  it("never shows links on screen outside the emulators", () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    delete process.env.FIRESTORE_EMULATOR_HOST;
    expect(mailerConfigured()).toBe(false);
    expect(devMailMode()).toBe(false);
    process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
    process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
    expect(devMailMode()).toBe(true);
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "x@zukka.example";
    expect(devMailMode()).toBe(false);
  });
});
