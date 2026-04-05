const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

const REGION = 'us-central1';

function safeNonNegativeInt(value, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return fallback;
    return Math.floor(n);
}

function safeNonNegativeNumber(value, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return fallback;
    return n;
}

function trimStr(value) {
    if (value == null) return '';
    return String(value).trim();
}

/**
 * instanceof can fail across module boundaries; HttpsError always sets code + httpErrorCode.
 */
function isHttpsError(error) {
    return (
        error instanceof functions.https.HttpsError ||
        (!!error &&
            typeof error.code === 'string' &&
            error.httpErrorCode &&
            typeof error.httpErrorCode.status === 'number')
    );
}

function truncateForClient(msg, maxLen) {
    const s = String(msg == null ? '' : msg);
    const m = maxLen || 2000;
    return s.length > m ? `${s.slice(0, m)}…` : s;
}

function mapKnownBackendError(error) {
    if (!error || typeof error !== 'object') return null;
    const c = error.code;
    if (c === 7 || c === 'PERMISSION_DENIED') {
        return 'Firestore permission denied. Confirm the Functions default service account can access Firestore in this project.';
    }
    if (c === 8 || c === 'RESOURCE_EXHAUSTED') {
        return 'Firestore quota exceeded.';
    }
    if (c === 14 || c === 'UNAVAILABLE' || c === 'unavailable') {
        return 'Firestore or Auth service temporarily unavailable; retry in a moment.';
    }
    if (typeof c === 'string' && c.startsWith('auth/')) {
        return error.message || c;
    }
    return null;
}

function wrapUnexpectedError(error, prefix) {
    if (isHttpsError(error)) {
        throw error;
    }
    const mapped = mapKnownBackendError(error);
    const raw = mapped || (error && error.message ? error.message : String(error));
    throw new functions.https.HttpsError(
        'failed-precondition',
        truncateForClient(`${prefix}: ${raw}`),
    );
}

/** Firestore rejects undefined field values in Node Admin SDK. */
function stripUndefined(obj) {
    const out = {};
    Object.keys(obj || {}).forEach((k) => {
        const v = obj[k];
        if (v !== undefined) {
            out[k] = v;
        }
    });
    return out;
}

/**
 * Serialize a Firestore doc for JSON callable response (timestamps → epoch ms).
 */
function serializeFirestoreDoc(docSnap) {
    const raw = docSnap.data();
    const row = { id: docSnap.id };
    Object.keys(raw || {}).forEach((k) => {
        const v = raw[k];
        if (v && typeof v.toMillis === 'function') {
            row[k] = v.toMillis();
        } else if (v !== undefined) {
            row[k] = v;
        }
    });
    return row;
}

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

        const payload = data || {};
        const { email, password, displayName, phoneNumber } = payload;

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
        if (isHttpsError(error)) {
            throw error;
        }
        if (error.code === 'auth/email-already-exists') {
            throw new functions.https.HttpsError('already-exists', 'That email is already registered in Authentication.');
        }
        if (error.code === 'auth/invalid-email') {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid email address.');
        }
        if (error.code === 'auth/weak-password') {
            throw new functions.https.HttpsError('invalid-argument', 'Password is too weak. Use a stronger password.');
        }
        wrapUnexpectedError(error, 'Failed to create staff account');
    }
});

exports.deleteStaffUser = functions.region(REGION).https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }

        const payload = data || {};
        const { staffUid } = payload;
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
        if (isHttpsError(error)) {
            throw error;
        }
        if (error.code === 'auth/user-not-found') {
            throw new functions.https.HttpsError('not-found', 'Staff user no longer exists in Authentication.');
        }
        wrapUnexpectedError(error, 'Failed to delete staff account');
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

        const payload = data || {};
        const { staffUid } = payload;
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
        if (isHttpsError(error)) {
            throw error;
        }
        wrapUnexpectedError(error, 'Failed to reset staff password');
    }
});

exports.superAdminCreateHotel = functions
    .runWith({ timeoutSeconds: 120, memory: '512MB' })
    .region(REGION)
    .https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }

        const adminDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
        if (!adminDoc.exists || adminDoc.data().role !== 'super_admin') {
            throw new functions.https.HttpsError('permission-denied', 'Only super admins can create hotels');
        }

        const payload = data || {};
        const { ownerEmail, hotel } = payload;
        if (!ownerEmail || typeof ownerEmail !== 'string') {
            throw new functions.https.HttpsError('invalid-argument', 'ownerEmail is required');
        }
        if (!hotel || typeof hotel !== 'object') {
            throw new functions.https.HttpsError('invalid-argument', 'hotel payload is required');
        }

        const hotelName = trimStr(hotel.name);
        if (!hotelName) {
            throw new functions.https.HttpsError('invalid-argument', 'hotel.name is required');
        }

        const normalizedEmail = trimStr(ownerEmail).toLowerCase();
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
            if (e.code === 'auth/invalid-email') {
                throw new functions.https.HttpsError('invalid-argument', 'Invalid owner email address.');
            }
            throw new functions.https.HttpsError(
                'failed-precondition',
                'Could not look up owner in Authentication. Check the email and Firebase Auth setup.',
            );
        }

        const ownerUid = ownerRecord.uid;
        const totalRooms = safeNonNegativeInt(hotel.totalRooms, 0);
        let availableRooms = hotel.availableRooms != null
            ? safeNonNegativeInt(hotel.availableRooms, totalRooms)
            : totalRooms;
        if (availableRooms > totalRooms) availableRooms = totalRooms;
        const totalRevenue = safeNonNegativeNumber(hotel.totalRevenue, 0);

        const amenities = Array.isArray(hotel.amenities)
            ? hotel.amenities.filter((a) => typeof a === 'string')
            : [];

        const hotelPayload = stripUndefined({
            name: hotelName,
            ownerId: ownerUid,
            ownerName: trimStr(hotel.ownerName) || ownerRecord.displayName || '',
            address: trimStr(hotel.address),
            phone: trimStr(hotel.phone),
            email: trimStr(hotel.email),
            description: trimStr(hotel.description),
            isActive: hotel.isActive !== false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            amenities,
            totalRooms,
            availableRooms,
            totalRevenue,
        });

        const hotelRef = await admin.firestore().collection('hotels').add(hotelPayload);

        const hotelId = hotelRef.id;

        const ownerPhone =
            trimStr(hotel.ownerPhone) ||
            (typeof ownerRecord.phoneNumber === 'string' ? ownerRecord.phoneNumber : '') ||
            null;

        const userPayload = stripUndefined({
            uid: ownerUid,
            email: normalizedEmail,
            displayName: trimStr(hotel.ownerName) || ownerRecord.displayName || '',
            phoneNumber: ownerPhone,
            role: 'hotel_owner',
            hotelId,
            isActive: true,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        await admin.firestore().collection('users').doc(ownerUid).set(userPayload, { merge: true });

        return { success: true, hotelId, ownerUid };
    } catch (error) {
        console.error('Error in superAdminCreateHotel:', error);
        if (isHttpsError(error)) {
            throw error;
        }
        wrapUnexpectedError(error, 'Could not create hotel');
    }
});

/**
 * List all Firestore user profiles (Admin SDK). Bypasses client list-query rule edge cases.
 */
exports.superAdminListUsers = functions.region(REGION).https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }

        const adminDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
        if (!adminDoc.exists || adminDoc.data().role !== 'super_admin') {
            throw new functions.https.HttpsError('permission-denied', 'Only super admins can list all users');
        }

        const snap = await admin.firestore().collection('users').get();
        const users = snap.docs.map((d) => serializeFirestoreDoc(d));

        return { users };
    } catch (error) {
        console.error('Error in superAdminListUsers:', error);
        wrapUnexpectedError(error, 'Could not list users');
    }
});

/**
 * List all hotels (Admin SDK). Same pattern as superAdminListUsers.
 */
exports.superAdminListHotels = functions.region(REGION).https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }

        const adminDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
        if (!adminDoc.exists || adminDoc.data().role !== 'super_admin') {
            throw new functions.https.HttpsError('permission-denied', 'Only super admins can list all hotels');
        }

        const snap = await admin.firestore().collection('hotels').get();
        const hotels = snap.docs.map((d) => serializeFirestoreDoc(d));

        return { hotels };
    } catch (error) {
        console.error('Error in superAdminListHotels:', error);
        wrapUnexpectedError(error, 'Could not list hotels');
    }
});
