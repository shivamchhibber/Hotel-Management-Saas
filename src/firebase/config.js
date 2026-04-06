import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY || 'AIzaSyCmbBgb9jd97dZykUbIDzD4Oo6FkXh00xA',
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || 'botarmy-hotel-management.firebaseapp.com',
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || 'botarmy-hotel-management',
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || 'botarmy-hotel-management.firebasestorage.app',
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || '1012001482685',
    appId: process.env.REACT_APP_FIREBASE_APP_ID || '1:1012001482685:web:07ecea858a21336caed4d4',
    measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || 'G-C2SV5Z2GKZ',
};

const FUNCTIONS_REGION = process.env.REACT_APP_FIREBASE_FUNCTIONS_REGION || 'us-central1';

/** Match server timeout for cold starts; default SDK timeout is 70s. */
export const HTTPS_CALLABLE_LONG_TIMEOUT_MS = 120000;

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, FUNCTIONS_REGION);

if (process.env.NODE_ENV === 'development') {
    // connectAuthEmulator(auth, "http://localhost:9099");
    // connectFirestoreEmulator(db, 'localhost', 8080);
    // connectFunctionsEmulator(functions, "localhost", 5001);
}

export default app;
