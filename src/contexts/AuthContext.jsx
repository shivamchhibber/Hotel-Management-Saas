import React, { createContext, useContext, useEffect, useState } from 'react';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    signInWithPhoneNumber,
    RecaptchaVerifier,
    signOut,
    onAuthStateChanged,
    updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [loading, setLoading] = useState(true);

    // Infer role from email for demo/testing convenience
    const inferRoleFromEmail = (email) => {
        if (!email) return 'guest';
        const normalized = email.trim().toLowerCase();
        if (normalized === 'admin@test.com') return 'super-admin';
        if (normalized === 'owner@test.com') return 'hotel-owner';
        if (normalized === 'staff@test.com') return 'hotel-staff';
        if (normalized === 'guest@test.com') return 'guest';
        return 'guest';
    };

    const ensureUserDoc = async (user) => {
        if (!user) return null;
        const userRef = doc(db, 'users', user.uid);
        const snapshot = await getDoc(userRef);
        if (!snapshot.exists()) {
            const role = inferRoleFromEmail(user.email);
            await setDoc(userRef, {
                uid: user.uid,
                email: user.email || null,
                displayName: user.displayName || null,
                photoURL: user.photoURL || null,
                role,
                isActive: true,
                createdAt: new Date()
            });
            return role;
        }
        const data = snapshot.data();
        return data?.role || null;
    };

    // Sign up with email and password
    const signup = async (email, password, displayName, role = 'guest') => {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Update profile
            await updateProfile(user, { displayName });

            // Create user document in Firestore
            await setDoc(doc(db, 'users', user.uid), {
                uid: user.uid,
                email: user.email,
                displayName,
                role,
                createdAt: new Date(),
                isActive: true
            });

            return userCredential;
        } catch (error) {
            throw error;
        }
    };

    // Sign in with email and password
    const login = async (email, password) => {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            // Ensure Firestore user doc exists with a role
            await ensureUserDoc(userCredential.user);
            return userCredential;
        } catch (error) {
            throw error;
        }
    };

    // Sign in with Google
    const loginWithGoogle = async () => {
        try {
            const provider = new GoogleAuthProvider();
            const userCredential = await signInWithPopup(auth, provider);

            // Check if user exists in Firestore, if not create them
            const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
            if (!userDoc.exists()) {
                await setDoc(doc(db, 'users', userCredential.user.uid), {
                    uid: userCredential.user.uid,
                    email: userCredential.user.email,
                    displayName: userCredential.user.displayName,
                    photoURL: userCredential.user.photoURL,
                    role: 'guest',
                    createdAt: new Date(),
                    isActive: true
                });
            }

            return userCredential;
        } catch (error) {
            throw error;
        }
    };

    // Sign in with phone number (for India)
    const loginWithPhone = async (phoneNumber, appVerifier) => {
        try {
            const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
            return confirmationResult;
        } catch (error) {
            throw error;
        }
    };

    // Verify phone OTP
    const verifyPhoneOTP = async (confirmationResult, otp) => {
        try {
            const userCredential = await confirmationResult.confirm(otp);

            // Check if user exists in Firestore, if not create them
            const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
            if (!userDoc.exists()) {
                await setDoc(doc(db, 'users', userCredential.user.uid), {
                    uid: userCredential.user.uid,
                    phoneNumber: userCredential.user.phoneNumber,
                    role: 'guest',
                    createdAt: new Date(),
                    isActive: true
                });
            }

            return userCredential;
        } catch (error) {
            throw error;
        }
    };

    // Sign out
    const logout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            throw error;
        }
    };

    // Get user role from Firestore
    const getUserRole = async (uid) => {
        try {
            console.log('Fetching user role for UID:', uid);
            const userDoc = await getDoc(doc(db, 'users', uid));
            console.log('User document exists:', userDoc.exists());
            if (userDoc.exists()) {
                const userData = userDoc.data();
                console.log('User document data:', userData);
                return userData.role;
            }
            console.log('User document does not exist in Firestore');
            return null;
        } catch (error) {
            console.error('Error getting user role:', error);
            return null;
        }
    };

    // Update user role (for admin functions)
    const updateUserRole = async (uid, newRole) => {
        try {
            await setDoc(doc(db, 'users', uid), { role: newRole }, { merge: true });
            if (currentUser && currentUser.uid === uid) {
                setUserRole(newRole);
            }
        } catch (error) {
            throw error;
        }
    };

    // Listen for auth state changes
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            console.log('Auth state changed:', user ? user.email : 'No user');
            if (user) {
                setCurrentUser(user);
                // Create user doc if missing and read role
                const ensuredRole = await ensureUserDoc(user);
                const role = ensuredRole ?? (await getUserRole(user.uid));
                console.log('User role fetched:', role);
                setUserRole(role);
            } else {
                setCurrentUser(null);
                setUserRole(null);
            }
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const value = {
        currentUser,
        userRole,
        loading,
        signup,
        login,
        loginWithGoogle,
        loginWithPhone,
        verifyPhoneOTP,
        logout,
        updateUserRole
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
