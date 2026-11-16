# Notes for Claude Code

Zukka: a platform of learning games for 6 to 9 year olds, made by parents with the help of AI.
UI and games are in English (British). Code, comments and commit messages in English.

## Layout

- `apps/web`: main site (Next.js App Router). Deployed as Vercel project "zukka".
- `apps/play`: games origin. Serves only `/g/<id>` with strict headers. Vercel project "zukka-play".
- `packages/game-protocol`: event schema (Zod), host-side play session, game response headers, game SDK snippet.
- `games/<id>/game.html` + `meta.json`: built-in games, bundled by `scripts/build-games.mjs`
  into `apps/play/src/generated` and `apps/web/src/generated` (both gitignored, regenerated on dev/build).
- `docs/`: `GAME-FORMAT.md` (what a game must be), `SANDBOX.md` (isolation), `FIREBASE.md` (data model, setup),
  `REVIEW-CHECKLIST.md` (input for the AI review), `PLAN-FIRESTORE.md` (ledgers, leaderboards and quotas for phases 7-9).
- Emails: with RESEND_API_KEY + EMAIL_FROM, sign-in links are generated with the Admin SDK and sent with Resend
  (`lib/server/mailer.ts`); without them Firebase sends the email (few per day on the free plan).
- `/api/cron/nightly` (Vercel Cron, CRON_SECRET): deletes expired rate-limit counters (no Firestore TTL on the free plan).
- `apps/web/src/lib/server/`: server-only code (Firebase Admin, session cookies, accounts, PIN, rate limits).
  Pages and server actions take the account id from the session (`requireAccount`, `requireParent`), never from the browser.
- `firebase/firestore.rules`: deny everything; browsers never talk to Firestore.

## Rules to keep

- Never weaken the sandbox: iframe `sandbox="allow-scripts"` only; game CSP from `gameResponseHeaders()`;
  main site `frame-src` limited to the games origin. Any change there needs the e2e sandbox tests green.
- A game receives no player data. The host accepts only the three events and measures time itself.
- Points and credits are computed server side only (later phases).
- Children never type free text that others can see. Child nicknames come only from `lib/nicknames.ts`.
- The parent's email is never stored in Firestore nor shown on any page other than their own sign-in screens.
- Answers the child checks by themselves never count (see `docs/GAME-FORMAT.md`).
- Next.js here is 16.x: read `node_modules/next/dist/docs/` before using an API you are unsure of.

## Checks

- `npm test` (Vitest unit tests), `npm run test:emu` (Firestore/Auth emulators), `npm run typecheck`, `npm run lint -w web`
- `npm run check:school-cup` (every subject, year and level makes valid questions)
- `npm run build && npm run e2e` (accounts, sandbox and School Cup end to end, on the emulators). Stop old `next start` servers first.
