import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// 1. Load keys from .env.local file
const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID,
};

// 2. Initialize the Connection
const app = initializeApp(firebaseConfig);

// 3. Export the tools we need
export const auth = getAuth(app);
export const db = getFirestore(app);

// 4. Log to console to verify connection
console.log("🔥 Firebase Connected Successfully to:", firebaseConfig.projectId);
