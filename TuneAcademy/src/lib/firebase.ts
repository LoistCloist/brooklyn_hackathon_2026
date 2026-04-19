import { type FirebaseApp, getApps, initializeApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getFunctions, type Functions } from "firebase/functions";
import { getStorage, type FirebaseStorage } from "firebase/storage";

function readEnv(name: string): string {
   const v = import.meta.env[name];
   if (!v || typeof v !== "string") {
      throw new Error(`Missing environment variable ${name}. Add it to your .env file.`);
   }
   return v;
}

let app: FirebaseApp | undefined;

export function getFirebaseApp(): FirebaseApp {
   if (typeof window === "undefined") {
      throw new Error("Firebase client SDK is only available in the browser.");
   }
   if (!app) {
      app =
         getApps()[0] ??
         initializeApp({
            apiKey: readEnv("VITE_FIREBASE_API_KEY"),
            authDomain: readEnv("VITE_FIREBASE_AUTH_DOMAIN"),
            projectId: readEnv("VITE_FIREBASE_PROJECT_ID"),
            storageBucket: readEnv("VITE_FIREBASE_STORAGE_BUCKET"),
            messagingSenderId: readEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
            appId: readEnv("VITE_FIREBASE_APP_ID"),
            ...(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
               ? { measurementId: String(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID) }
               : {}),
         });
   }
   return app;
}

export function getFirebaseAuth(): Auth {
   return getAuth(getFirebaseApp());
}

export function getFirestoreDb(): Firestore {
   return getFirestore(getFirebaseApp());
}

export function getFirebaseStorage(): FirebaseStorage {
   return getStorage(getFirebaseApp());
}

export function getFirebaseFunctions(): Functions {
   return getFunctions(getFirebaseApp(), "us-east1");
}
