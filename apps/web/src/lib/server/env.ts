import "server-only";

/**
 * Server configuration. With FIREBASE_AUTH_EMULATOR_HOST and FIRESTORE_EMULATOR_HOST set
 * (local development and tests), no real Firebase project or key is needed.
 */
export const usingEmulators = () => !!process.env.FIREBASE_AUTH_EMULATOR_HOST && !!process.env.FIRESTORE_EMULATOR_HOST;

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}

export function firebaseProjectId(): string {
  return process.env.FIREBASE_PROJECT_ID ?? (usingEmulators() ? "demo-zukka" : required("FIREBASE_PROJECT_ID"));
}

/** Web API key of the Firebase project (used only by the server for the email link REST calls). */
export function firebaseApiKey(): string {
  return process.env.FIREBASE_API_KEY ?? (usingEmulators() ? "fake-api-key" : required("FIREBASE_API_KEY"));
}

/** Secret for signing Zukka's own cookies (player choice, parent area unlock, pending sign-in). */
export function sessionSecret(): string {
  const s =
    process.env.SESSION_SECRET ??
    (process.env.NODE_ENV !== "production" || usingEmulators() ? "dev-only-secret-change-me-dev-only-secret" : "");
  if (s.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  return s;
}

/** Public address of the site, used in the sign-in links. */
export function appOrigin(): string {
  return (process.env.APP_ORIGIN ?? "http://localhost:3000").replace(/\/$/, "");
}

/** Cookies are marked Secure except when testing over plain http on localhost. */
export const secureCookies = () => appOrigin().startsWith("https://");
