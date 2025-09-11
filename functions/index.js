const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
admin.initializeApp();

// Create staff user function
exports.createStaffUser = functions.https.onCall(async (data, context) => {
    try {
        // Verify the user is authenticated and is a hotel owner
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }

        const { email, password, displayName, phoneNumber, hotelId } = data;

        // Validate required fields
        if (!email || !password || !displayName || !hotelId) {
            throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
        }

        // Verify the calling user is a hotel owner
        const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
        if (!userDoc.exists || userDoc.data().role !== 'hotel_owner') {
            throw new functions.https.HttpsError('permission-denied', 'Only hotel owners can create staff accounts');
        }

        // Create the staff user with Admin SDK (this won't sign them in)
        const userRecord = await admin.auth().createUser({
            email: email,
            password: password,
            displayName: displayName,
            phoneNumber: phoneNumber || null
        });

        // Create the staff document in Firestore
        await admin.firestore().collection('users').doc(userRecord.uid).set({
            uid: userRecord.uid,
            displayName: displayName,
            email: email,
            phoneNumber: phoneNumber || null,
            hotelId: hotelId,
            role: 'hotel_staff',
            isActive: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: context.auth.uid
        });

        // Return success response
        return {
            success: true,
            message: 'Staff account created successfully',
            staffData: {
                uid: userRecord.uid,
                email: email,
                displayName: displayName,
                phoneNumber: phoneNumber
            }
        };

    } catch (error) {
        console.error('Error creating staff user:', error);
        
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        
        throw new functions.https.HttpsError('internal', 'Failed to create staff account: ' + error.message);
    }
});

// Delete staff user function
exports.deleteStaffUser = functions.https.onCall(async (data, context) => {
    try {
        // Verify the user is authenticated and is a hotel owner
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }

        const { staffUid } = data;

        // Validate required fields
        if (!staffUid) {
            throw new functions.https.HttpsError('invalid-argument', 'Staff UID is required');
        }

        // Verify the calling user is a hotel owner
        const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
        if (!userDoc.exists || userDoc.data().role !== 'hotel_owner') {
            throw new functions.https.HttpsError('permission-denied', 'Only hotel owners can delete staff accounts');
        }

        // Verify the staff member belongs to the same hotel
        const staffDoc = await admin.firestore().collection('users').doc(staffUid).get();
        if (!staffDoc.exists || staffDoc.data().role !== 'hotel_staff') {
            throw new functions.https.HttpsError('not-found', 'Staff member not found');
        }

        const ownerDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
        const ownerData = ownerDoc.data();
        
        // Get hotel ID from owner
        const hotelSnap = await admin.firestore().collection('hotels')
            .where('ownerId', '==', context.auth.uid)
            .limit(1)
            .get();
        
        if (hotelSnap.empty) {
            throw new functions.https.HttpsError('not-found', 'Hotel not found for owner');
        }
        
        const hotelId = hotelSnap.docs[0].id;
        
        if (staffDoc.data().hotelId !== hotelId) {
            throw new functions.https.HttpsError('permission-denied', 'Cannot delete staff from different hotel');
        }

        // Delete the staff user from Firebase Auth
        await admin.auth().deleteUser(staffUid);

        // Delete the staff document from Firestore
        await admin.firestore().collection('users').doc(staffUid).delete();

        // Return success response
        return {
            success: true,
            message: 'Staff account deleted successfully'
        };

    } catch (error) {
        console.error('Error deleting staff user:', error);
        
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        
        throw new functions.https.HttpsError('internal', 'Failed to delete staff account: ' + error.message);
    }
});

// Reset staff password function
exports.resetStaffPassword = functions.https.onCall(async (data, context) => {
    try {
        // Verify the user is authenticated and is a hotel owner
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }

        const { staffUid } = data;

        // Validate required fields
        if (!staffUid) {
            throw new functions.https.HttpsError('invalid-argument', 'Staff UID is required');
        }

        // Verify the calling user is a hotel owner
        const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
        if (!userDoc.exists || userDoc.data().role !== 'hotel_owner') {
            throw new functions.https.HttpsError('permission-denied', 'Only hotel owners can reset staff passwords');
        }

        // Verify the staff member belongs to the same hotel
        const staffDoc = await admin.firestore().collection('users').doc(staffUid).get();
        if (!staffDoc.exists || staffDoc.data().role !== 'hotel_staff') {
            throw new functions.https.HttpsError('not-found', 'Staff member not found');
        }

        // Get hotel ID from owner
        const hotelSnap = await admin.firestore().collection('hotels')
            .where('ownerId', '==', context.auth.uid)
            .limit(1)
            .get();
        
        if (hotelSnap.empty) {
            throw new functions.https.HttpsError('not-found', 'Hotel not found for owner');
        }
        
        const hotelId = hotelSnap.docs[0].id;
        
        if (staffDoc.data().hotelId !== hotelId) {
            throw new functions.https.HttpsError('permission-denied', 'Cannot reset password for staff from different hotel');
        }

        // Generate new password
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let newPassword = '';
        for (let i = 0; i < 12; i++) {
            newPassword += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        // Update the staff user's password
        await admin.auth().updateUser(staffUid, {
            password: newPassword
        });

        // Return success response with new password
        return {
            success: true,
            message: 'Staff password reset successfully',
            newPassword: newPassword,
            staffEmail: staffDoc.data().email,
            staffName: staffDoc.data().displayName
        };

    } catch (error) {
        console.error('Error resetting staff password:', error);
        
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        
        throw new functions.https.HttpsError('internal', 'Failed to reset staff password: ' + error.message);
    }
});
