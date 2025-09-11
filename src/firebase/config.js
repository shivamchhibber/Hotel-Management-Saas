import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

// Firebase configuration
// Replace these with your actual Firebase config values
const firebaseConfig = {
    apiKey: "AIzaSyCmbBgb9jd97dZykUbIDzD4Oo6FkXh00xA",
    authDomain: "botarmy-hotel-management.firebaseapp.com",
    projectId: "botarmy-hotel-management",
    storageBucket: "botarmy-hotel-management.firebasestorage.app",
    messagingSenderId: "1012001482685",
    appId: "1:1012001482685:web:07ecea858a21336caed4d4",
    measurementId: "G-C2SV5Z2GKZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);

// Connect to emulators in development
if (process.env.NODE_ENV === 'development') {
    // Uncomment these lines when you want to use Firebase emulators
    // connectAuthEmulator(auth, "http://localhost:9099");
    // connectFirestoreEmulator(db, 'localhost', 8080);
    // connectFunctionsEmulator(functions, "localhost", 5001);
}

export default app;
