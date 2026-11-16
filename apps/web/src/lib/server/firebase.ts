import "server-only";
import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { firebaseProjectId, usingEmulators } from "./env";

/**
 * Firebase Admin SDK, used only on the server. Credentials come from FIREBASE_CLIENT_EMAIL and
 * FIREBASE_PRIVATE_KEY (a service account); with the emulators none are needed.
 */
function app(): App {
  if (getApps().length) return getApp();
  const projectId = firebaseProjectId();
  if (usingEmulators()) return initializeApp({ projectId });
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = normalisePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
  if (!clientEmail || !privateKey) throw new Error("Missing FIREBASE_CLIENT_EMAIL or FIREBASE_PRIVATE_KEY");
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
}

/**
 * Accepts the private key as pasted from the service account JSON: with literal "\n" or real line breaks,
 * with or without the surrounding quotes, with stray spaces or Windows line endings.
 */
export function normalisePrivateKey(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let k = raw.trim();
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) k = k.slice(1, -1);
  k = k.replace(/\\n/g, "\n").replace(/\r/g, "").trim();
  return k.endsWith("\n") ? k : `${k}\n`;
}

export const adminAuth = () => getAuth(app());
export const db = () => getFirestore(app());
