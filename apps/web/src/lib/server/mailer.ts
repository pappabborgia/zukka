import "server-only";
import { usingEmulators } from "./env";

/**
 * Emails go out through Resend (https://resend.com), called with plain fetch.
 * Needs RESEND_API_KEY and EMAIL_FROM (an address on a domain verified in Resend).
 * In local development with the emulators and no key, nothing is sent and the caller shows the link on screen.
 */
export class MailerError extends Error {}

export interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export function mailerConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
}

/** True when emails cannot be sent and the app may show sign-in links on screen instead (emulators only). */
export function devMailMode(): boolean {
  return usingEmulators() && !mailerConfigured();
}

export async function sendEmail(mail: Email): Promise<void> {
  if (!mailerConfigured()) throw new MailerError("RESEND_API_KEY or EMAIL_FROM missing");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [mail.to],
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      ...(process.env.EMAIL_REPLY_TO ? { reply_to: process.env.EMAIL_REPLY_TO } : {}),
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new MailerError(`Resend answered ${res.status}`);
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** The sign-in email: plain, no images, no tracking. */
export function signInEmail(to: string, link: string): Email {
  const text = [
    "Hello,",
    "",
    "Here is your link to sign in to Zukka:",
    link,
    "",
    "It works only once, and only for a limited time. If you did not ask for it, you can ignore this email: nothing happens without the link.",
    "",
    "Zukka",
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#fff8ee;font-family:Arial,Helvetica,sans-serif;color:#1f1645">
<div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:24px;border:2px solid #f3e3c8">
<p style="font-size:22px;font-weight:bold;margin:0 0 16px">Zukka</p>
<p>Hello,</p>
<p>Here is your link to sign in to Zukka:</p>
<p style="margin:24px 0"><a href="${escapeHtml(link)}" style="background:#f7a531;color:#3a1d00;font-weight:bold;text-decoration:none;padding:12px 22px;border-radius:99px;display:inline-block">Sign in to Zukka</a></p>
<p style="font-size:14px;color:#5b5478">It works only once, and only for a limited time. If you did not ask for it, you can ignore this email: nothing happens without the link.</p>
</div></body></html>`;
  return { to, subject: "Your Zukka sign-in link", text, html };
}
