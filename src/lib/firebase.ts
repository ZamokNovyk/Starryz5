import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, initializeAuth, browserLocalPersistence, GoogleAuthProvider } from 'firebase/auth';

// Retrieve environment variables with compatibility
const getEnvVar = (key: string): string => {
  try {
    // Check Vite environment variables
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta && import.meta.env && import.meta.env[key]) {
      // @ts-ignore
      return import.meta.env[key];
    }
  } catch (e) {
    // Fallback if import.meta is not available
  }

  try {
    // Check Next.js / Node process environment variables
    if (typeof process !== 'undefined' && process && process.env && process.env[key]) {
      return process.env[key] as string;
    }
  } catch (e) {
    // Fallback if process is not available
  }

  return '';
};

const firebaseConfig = {
  apiKey: getEnvVar('VITE_FIREBASE_API_KEY') || 'placeholder-api-key',
  authDomain: "starryz5-usuarios.firebaseapp.com",
  projectId: "starryz5-usuarios",
  storageBucket: "starryz5-usuarios.firebasestorage.app",
  messagingSenderId: "1048861626265",
  appId: "1:1048861626265:web:406d52cf245be964368d08"
};

// Initialize Firebase App
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Force explicit local storage persistence to prevent the "Database is closing/hidden" IndexedDB bug
export const auth = (() => {
  try {
    return initializeAuth(app, {
      persistence: browserLocalPersistence
    });
  } catch (e) {
    return getAuth(app);
  }
})();

export const googleProvider = new GoogleAuthProvider();

// Custom parameters can be set for Google provider if desired
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export default app;

