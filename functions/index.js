const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

const REGION = 'us-central1';

/**
 * Hotel owner's Firestore hotel document id (authoritative), derived from Auth uid.
 */
async function getHotelIdForOwnerUid(ownerAuthUid) {
    const hotelSnap = await admin.firestore().collection('hotels')
        .where('ownerId', '==', ownerAuthUid)
        .limit(1)
        .get();
    if (hotelSnap.empty) {
        return null;
    }
    return hotelSnap.docs[0].id;
}

exports.createStaffUser = functions.region(REGION).https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }

        const { email, password, displayName, phoneNumber } = data;

        if (!email || !password || !displayName) {
            throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
        }

        const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
        if (!userDoc.exists || userDoc.data().role !== 'hotel_owner') {
            throw new functions.https.HttpsError('permission-denied', 'Only hotel owners can create staff accounts');
        }

        const hotelId = await getHotelIdForOwnerUid(context.auth.uid);
        if (!hotelId) {
            throw new functions.https.HttpsError('failed-precondition', 'No hotel found for this owner');
        }

        const userRecord = await admin.auth().createUser({
            email,
            password,
            displayName,
            phoneNumber: phoneNumber || null,
        });

        await admin.firestore().collection('users').doc(userRecord.uid).set({
            uid: userRecord.uid,
            displayName,
            email,
            phoneNumber: phoneNumber || null,
            hotelId,
            role: 'hotel_staff',
            isActive: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: context.auth.uid,
        });

        return {
            success: true,
            message: 'Staff account created successfully',
            staffData: {
                uid: userRecord.uid,
                email,
                displayName,
                phoneNumber: phoneNumber || null,
            },
        };
    } catch (error) {
        console.error('Error creating staff user:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'Failed to create staff account: ' + error.message);
    }
});

exports.deleteStaffUser = functions.region(REGION).https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }

        const { staffUid } = data;
        if (!staffUid) {
            throw new functions.https.HttpsError('invalid-argument', 'Staff UID is required');
        }

        const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
        if (!userDoc.exists || userDoc.data().role !== 'hotel_owner') {
            throw new functions.https.HttpsError('permission-denied', 'Only hotel owners can delete staff accounts');
        }

        const staffDoc = await admin.firestore().collection('users').doc(staffUid).get();
        if (!staffDoc.exists || staffDoc.data().role !== 'hotel_staff') {
            throw new functions.https.HttpsError('not-found', 'Staff member not found');
        }

        const hotelId = await getHotelIdForOwnerUid(context.auth.uid);
        if (!hotelId) {
            throw new functions.https.HttpsError('not-found', 'Hotel not found for owner');
        }

        if (staffDoc.data().hotelId !== hotelId) {
            throw new functions.https.HttpsError('permission-denied', 'Cannot delete staff from different hotel');
        }

        await admin.auth().deleteUser(staffUid);
        await admin.firestore().collection('users').doc(staffUid).delete();

        return { success: true, message: 'Staff account deleted successfully' };
    } catch (error) {
        console.error('Error deleting staff user:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'Failed to delete staff account: ' + error.message);
    }
});

async function sendPasswordResetEmailOptional(link, staffEmail, staffName) {
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT || '587';
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM || user;

    if (!host || !user || !pass) {
        console.warn('resetStaffPassword: SMTP_HOST/SMTP_USER/SMTP_PASS not set; reset link not emailed');
        return false;
    }

    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
        host,
        port: parseInt(port, 10),
        secure: port === '465',
        auth: { user, pass },
    });

    await transporter.sendMail({
        from,
        to: staffEmail,
        subject: 'Reset your password',
        text: `Hello${staffName ? ' ' + staffName : ''},\n\nUse this link to set a new password (expires soon):\n${link}\n`,
        html: `<p>Hello${staffName ? ' ' + staffName : ''},</p><p><a href="${link}">Set a new password</a></p>`,
    });
    return true;
}

exports.resetStaffPassword = functions.region(REGION).https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }

        const { staffUid } = data;
        if (!staffUid) {
            throw new functions.https.HttpsError('invalid-argument', 'Staff UID is required');
        }

        const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
        if (!userDoc.exists || userDoc.data().role !== 'hotel_owner') {
            throw new functions.https.HttpsError('permission-denied', 'Only hotel owners can reset staff passwords');
        }

        const staffDoc = await admin.firestore().collection('users').doc(staffUid).get();
        if (!staffDoc.exists || staffDoc.data().role !== 'hotel_staff') {
            throw new functions.https.HttpsError('not-found', 'Staff member not found');
        }

        const staffEmail = staffDoc.data().email;
        if (!staffEmail) {
            throw new functions.https.HttpsError('failed-precondition', 'Staff user has no email');
        }

        const hotelId = await getHotelIdForOwnerUid(context.auth.uid);
        if (!hotelId) {
            throw new functions.https.HttpsError('not-found', 'Hotel not found for owner');
        }

        if (staffDoc.data().hotelId !== hotelId) {
            throw new functions.https.HttpsError('permission-denied', 'Cannot reset password for staff from different hotel');
        }

        const link = await admin.auth().generatePasswordResetLink(staffEmail);
        const staffName = staffDoc.data().displayName || '';
        const emailSent = await sendPasswordResetEmailOptional(link, staffEmail, staffName);

        return {
            success: true,
            message: emailSent
                ? 'Password reset email sent to staff member'
                : 'Password reset link generated but email was not sent (configure SMTP_* environment variables on the function)',
            emailSent,
            staffEmail,
            staffName,
        };
    } catch (error) {
        console.error('Error resetting staff password:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'Failed to reset staff password: ' + error.message);
    }
});

exports.superAdminCreateHotel = functions.region(REGION).https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }

        const adminDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
        if (!adminDoc.exists || adminDoc.data().role !== 'super_admin') {
            throw new functions.https.HttpsError('permission-denied', 'Only super admins can create hotels');
        }

        const { ownerEmail, hotel } = data || {};
        if (!ownerEmail || typeof ownerEmail !== 'string') {
            throw new functions.https.HttpsError('invalid-argument', 'ownerEmail is required');
        }
        if (!hotel || typeof hotel !== 'object' || !hotel.name) {
            throw new functions.https.HttpsError('invalid-argument', 'hotel.name is required');
        }

        const normalizedEmail = ownerEmail.trim().toLowerCase();
        let ownerRecord;
        try {
            ownerRecord = await admin.auth().getUserByEmail(normalizedEmail);
        } catch (e) {
            if (e.code === 'auth/user-not-found') {
                throw new functions.https.HttpsError(
                    'failed-precondition',
                    'Owner must create a Firebase Auth account first (sign up), then a super admin can attach a hotel.',
                );
            }
            throw e;
        }

        const ownerUid = ownerRecord.uid;
        const totalRooms = Number(hotel.totalRooms) || 0;

        const hotelRef = await admin.firestore().collection('hotels').add({
            name: hotel.name,
            ownerId: ownerUid,
            ownerName: hotel.ownerName || ownerRecord.displayName || '',
            address: hotel.address || '',
            phone: hotel.phone || '',
            email: hotel.email || '',
            description: hotel.description || '',
            isActive: hotel.isActive !== false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            amenities: Array.isArray(hotel.amenities) ? hotel.amenities : [],
            totalRooms,
            availableRooms: hotel.availableRooms != null ? Number(hotel.availableRooms) : totalRooms,
            totalRevenue: hotel.totalRevenue != null ? Number(hotel.totalRevenue) : 0,
        });

        const hotelId = hotelRef.id;

        await admin.firestore().collection('users').doc(ownerUid).set({
            uid: ownerUid,
            email: normalizedEmail,
            displayName: hotel.ownerName || ownerRecord.displayName || '',
            phoneNumber: hotel.ownerPhone || ownerRecord.phoneNumber || null,
            role: 'hotel_owner',
            hotelId,
            isActive: true,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        return { success: true, hotelId, ownerUid };
    } catch (error) {
        console.error('Error in superAdminCreateHotel:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'Failed to create hotel: ' + error.message);
    }
});
