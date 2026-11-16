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
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) throw new Error("Missing FIREBASE_CLIENT_EMAIL or FIREBASE_PRIVATE_KEY");
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
}

export const adminAuth = () => getAuth(app());
export const db = () => getFirestore(app());
