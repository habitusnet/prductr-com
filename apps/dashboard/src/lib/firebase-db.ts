/**
 * Firebase database access
 * Initializes Firebase Admin SDK and provides Firestore access
 */

import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { FirestoreStateStore } from "./firestore-store";

let firebaseApp: App | null = null;
let firestoreDb: Firestore | null = null;
let firestoreStore: FirestoreStateStore | null = null;

/**
 * Initialize Firebase Admin SDK
 */
function initializeFirebase(): App {
  if (firebaseApp) return firebaseApp;

  const existingApps = getApps();
  if (existingApps.length > 0) {
    firebaseApp = existingApps[0];
    return firebaseApp;
  }

  // Check for service account credentials
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  const projectId =
    process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;

  if (serviceAccount) {
    // Use service account JSON from environment variable
    try {
      const credentials = JSON.parse(serviceAccount);
      firebaseApp = initializeApp({
        credential: cert(credentials),
        projectId: credentials.project_id || projectId,
      });
    } catch (error) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT:", error);
      throw new Error("Invalid FIREBASE_SERVICE_ACCOUNT JSON");
    }
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // Use default credentials file
    firebaseApp = initializeApp({
      projectId,
    });
  } else {
    // Initialize without credentials (for local emulator or default credentials)
    firebaseApp = initializeApp({
      projectId: projectId || "conductor-dashboard",
    });
  }

  return firebaseApp;
}

/**
 * Get Firestore instance
 */
export function getFirestoreDb(): Firestore {
  if (firestoreDb) return firestoreDb;

  initializeFirebase();
  firestoreDb = getFirestore();

  // Connect to emulator if configured
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    // Emulator connection is automatic when FIRESTORE_EMULATOR_HOST is set
    console.log(
      "Using Firestore emulator at",
      process.env.FIRESTORE_EMULATOR_HOST,
    );
  }

  return firestoreDb;
}

/**
 * Get Firestore State Store
 */
export function getFirestoreStateStore(): FirestoreStateStore {
  if (firestoreStore) return firestoreStore;

  const db = getFirestoreDb();
  firestoreStore = new FirestoreStateStore(db);
  return firestoreStore;
}

/**
 * Get project ID from environment
 */
export function getProjectId(): string {
  return process.env.CONDUCTOR_PROJECT_ID || "default-project";
}

/**
 * Check if running with Firebase
 */
export function isFirebaseEnvironment(): boolean {
  return Boolean(
    process.env.FIREBASE_CONFIG ||
    process.env.FIREBASE_SERVICE_ACCOUNT ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.GCLOUD_PROJECT,
  );
}

// Re-export FirestoreStateStore
export { FirestoreStateStore };
