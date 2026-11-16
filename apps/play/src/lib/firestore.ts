import "server-only";
import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Read-only access to Firestore for the games origin. In production the service account
 * (FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY) has only the "Cloud Datastore Viewer" role.
 */
function normalisePrivateKey(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let k = raw.trim();
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) k = k.slice(1, -1);
  k = k.replace(/\\n/g, "\n").replace(/\r/g, "").trim();
  return k.endsWith("\n") ? k : `${k}\n`;
}

function app(): App {
  if (getApps().length) return getApp();
  const emulator = !!process.env.FIRESTORE_EMULATOR_HOST;
  const projectId = process.env.FIREBASE_PROJECT_ID ?? (emulator ? "demo-zukka" : undefined);
  if (!projectId) throw new Error("Missing FIREBASE_PROJECT_ID");
  if (emulator) return initializeApp({ projectId });
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = normalisePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
  if (!clientEmail || !privateKey) throw new Error("Missing FIREBASE_CLIENT_EMAIL or FIREBASE_PRIVATE_KEY");
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
}

export const db = () => getFirestore(app());
