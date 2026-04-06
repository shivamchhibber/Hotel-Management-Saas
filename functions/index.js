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

function normalizeEmail(email) {
    return trimStr(email).toLowerCase();
}

/** Firestore may store hotelId as string or DocumentReference; queries need a string id. */
function coerceHotelIdForAdmin(raw) {
    if (raw == null || raw === '') return null;
    if (typeof raw === 'string') {
        const t = trimStr(raw);
        return t || null;
    }
    if (typeof raw === 'object' && typeof raw.id === 'string') {
        return raw.id;
    }
    return null;
}

function coerceMoney(value, fallback) {
    const n = safeNonNegativeNumber(value, fallback);
    if (n == null) return n;
    // Keep as 2-decimal at most; store number.
    return Math.round(n * 100) / 100;
}

function computeNights(checkInMs, checkOutMs) {
    if (!Number.isFinite(checkInMs) || !Number.isFinite(checkOutMs) || checkOutMs <= checkInMs) {
        return 1;
    }
    const ONE_DAY = 24 * 60 * 60 * 1000;
    const diffDays = Math.ceil((checkOutMs - checkInMs) / ONE_DAY);
    return Math.max(1, diffDays);
}

function toEpochMs(tsLike) {
    if (!tsLike) return null;
    if (typeof tsLike === 'number') return tsLike;
    if (tsLike.toMillis) return tsLike.toMillis();
    if (tsLike.toDate) return tsLike.toDate().getTime();
    const d = new Date(tsLike);
    return Number.isNaN(d.getTime()) ? null : d.getTime();
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

/** Deep convert Firestore Timestamps (and nested) for JSON callable responses. */
function serializeForJson(value) {
    if (value == null) return value;
    if (typeof value === 'object' && value.constructor && value.constructor.name === 'DocumentReference') {
        return value.id;
    }
    if (typeof value === 'object' && typeof value.toMillis === 'function') {
        return value.toMillis();
    }
    if (typeof value === 'object' && typeof value.toDate === 'function') {
        return value.toDate().toISOString();
    }
    if (Array.isArray(value)) {
        return value.map(serializeForJson);
    }
    if (typeof value === 'object' && value !== null) {
        const out = {};
        Object.keys(value).forEach((k) => {
            out[k] = serializeForJson(value[k]);
        });
        return out;
    }
    return value;
}

function serializeDocDeep(docSnap) {
    const raw = docSnap.data();
    const row = { id: docSnap.id };
    Object.keys(raw || {}).forEach((k) => {
        row[k] = serializeForJson(raw[k]);
    });
    return row;
}

async function requireStaffHotelContext(uid) {
    const userSnap = await admin.firestore().collection('users').doc(uid).get();
    if (!userSnap.exists || userSnap.data().role !== 'hotel_staff') {
        throw new functions.https.HttpsError('permission-denied', 'Only hotel staff can use this.');
    }
    const hotelId = coerceHotelIdForAdmin(userSnap.data().hotelId);
    if (!hotelId) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            'Your profile has no hotelId. Ask the hotel owner to re-add you as staff.',
        );
    }
    const hotelSnap = await admin.firestore().collection('hotels').doc(hotelId).get();
    if (!hotelSnap.exists) {
        throw new functions.https.HttpsError('failed-precondition', 'Hotel not found for your profile hotelId.');
    }
    return { hotelId, userSnap };
}

/** Rooms may store hotelId as string id or DocumentReference to hotels/{id}. */
async function fetchRoomsForHotelAdmin(hotelId) {
    const db = admin.firestore();
    const hotelRef = db.doc(`hotels/${hotelId}`);
    const [snapStr, snapRef] = await Promise.all([
        db.collection('rooms').where('hotelId', '==', hotelId).get(),
        db.collection('rooms').where('hotelId', '==', hotelRef).get(),
    ]);
    const map = new Map();
    snapStr.docs.forEach((d) => map.set(d.id, d));
    snapRef.docs.forEach((d) => map.set(d.id, d));
    return Array.from(map.values());
}

/** Guest stay docs may store hotelId as string or DocumentReference. */
async function fetchGuestsForHotelAdmin(hotelId) {
    const db = admin.firestore();
    const hotelRef = db.doc(`hotels/${hotelId}`);
    const [snapStr, snapRef] = await Promise.all([
        db.collection('guests').where('hotelId', '==', hotelId).limit(500).get(),
        db.collection('guests').where('hotelId', '==', hotelRef).limit(500).get(),
    ]);
    const map = new Map();
    snapStr.docs.forEach((d) => map.set(d.id, d));
    snapRef.docs.forEach((d) => map.set(d.id, d));
    return Array.from(map.values());
}

function normalizeEmailLookup(email) {
    const e = trimStr(email).toLowerCase();
    return e || null;
}

/** Stay history docs may store hotelId as string or DocumentReference. */
async function fetchStaysForHotelAdmin(hotelId) {
    const db = admin.firestore();
    const hotelRef = db.doc(`hotels/${hotelId}`);
    const [snapStr, snapRef] = await Promise.all([
        db.collection('stays').where('hotelId', '==', hotelId).limit(1000).get(),
        db.collection('stays').where('hotelId', '==', hotelRef).limit(1000).get(),
    ]);
    const map = new Map();
    snapStr.docs.forEach((d) => map.set(d.id, d));
    snapRef.docs.forEach((d) => map.set(d.id, d));
    return Array.from(map.values());
}

/**
 * Canonical hotel id for an owner: prefer users/{uid}.hotelId when it points at a hotel they own,
 * then any hotel with ownerId (limit(1)). Keeps staff.hotelId aligned with superAdminCreateHotel + owner UI.
 */
async function getHotelIdForOwnerUid(ownerAuthUid) {
    const userDoc = await admin.firestore().collection('users').doc(ownerAuthUid).get();
    const profileHid = userDoc.exists ? coerceHotelIdForAdmin(userDoc.data().hotelId) : null;
    if (profileHid) {
        const h = await admin.firestore().collection('hotels').doc(profileHid).get();
        if (h.exists && h.data().ownerId === ownerAuthUid) {
            return profileHid;
        }
    }
    const hotelSnap = await admin.firestore().collection('hotels')
        .where('ownerId', '==', ownerAuthUid)
        .limit(1)
        .get();
    if (hotelSnap.empty) {
        return null;
    }
    return hotelSnap.docs[0].id;
}

/**
 * Email already in Firebase Auth (e.g. guest signup). Promote/link to staff for this hotel.
 */
async function attachExistingAuthUserAsStaff({
    normalizedEmail,
    password,
    displayName,
    phoneNumber,
    hotelId,
    ownerUid,
}) {
    const userRecord = await admin.auth().getUserByEmail(normalizedEmail);
    const uid = userRecord.uid;
    const staffRef = admin.firestore().collection('users').doc(uid);
    const staffSnap = await staffRef.get();

    if (staffSnap.exists) {
        const d = staffSnap.data() || {};
        if (d.role === 'super_admin') {
            throw new functions.https.HttpsError(
                'failed-precondition',
                'That account is a super admin and cannot be added as staff.',
            );
        }
        if (d.role === 'hotel_owner') {
            throw new functions.https.HttpsError(
                'failed-precondition',
                'That user is already a hotel owner; use a different email for staff.',
            );
        }
        if (d.role === 'hotel_staff' && d.hotelId && d.hotelId !== hotelId) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                'That user is already staff at another hotel.',
            );
        }
    }

    const authUpdate = stripUndefined({
        displayName: trimStr(displayName),
        password,
        phoneNumber: phoneNumber ? trimStr(phoneNumber) : undefined,
    });
    await admin.auth().updateUser(uid, authUpdate);

    const firePayload = stripUndefined({
        uid,
        displayName: trimStr(displayName),
        email: normalizedEmail,
        phoneNumber: phoneNumber ? trimStr(phoneNumber) : null,
        hotelId,
        role: 'hotel_staff',
        isActive: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: ownerUid,
        linkedAsStaffAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const existing = staffSnap.exists ? staffSnap.data() : null;
    if (!existing || !existing.createdAt) {
        firePayload.createdAt = admin.firestore.FieldValue.serverTimestamp();
    }
    await staffRef.set(firePayload, { merge: true });

    return {
        uid,
        email: normalizedEmail,
        displayName: trimStr(displayName),
        phoneNumber: phoneNumber ? trimStr(phoneNumber) : null,
    };
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

        const normalizedEmail = normalizeEmail(email);
        if (!normalizedEmail) {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid email address.');
        }

        const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
        if (!userDoc.exists || userDoc.data().role !== 'hotel_owner') {
            throw new functions.https.HttpsError('permission-denied', 'Only hotel owners can create staff accounts');
        }

        const hotelId = await getHotelIdForOwnerUid(context.auth.uid);
        if (!hotelId) {
            throw new functions.https.HttpsError('failed-precondition', 'No hotel found for this owner');
        }

        let staffData;
        try {
            const userRecord = await admin.auth().createUser({
                email: normalizedEmail,
                password,
                displayName: trimStr(displayName),
                phoneNumber: phoneNumber ? trimStr(phoneNumber) : null,
            });

            await admin.firestore().collection('users').doc(userRecord.uid).set({
                uid: userRecord.uid,
                displayName: trimStr(displayName),
                email: normalizedEmail,
                phoneNumber: phoneNumber ? trimStr(phoneNumber) : null,
                hotelId,
                role: 'hotel_staff',
                isActive: true,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                createdBy: context.auth.uid,
            });

            staffData = {
                uid: userRecord.uid,
                email: normalizedEmail,
                displayName: trimStr(displayName),
                phoneNumber: phoneNumber ? trimStr(phoneNumber) : null,
            };
        } catch (createErr) {
            if (createErr.code === 'auth/email-already-exists') {
                staffData = await attachExistingAuthUserAsStaff({
                    normalizedEmail,
                    password,
                    displayName,
                    phoneNumber,
                    hotelId,
                    ownerUid: context.auth.uid,
                });
            } else {
                throw createErr;
            }
        }

        return {
            success: true,
            message: 'Staff account saved successfully',
            staffData,
        };
    } catch (error) {
        console.error('Error creating staff user:', error);
        if (isHttpsError(error)) {
            throw error;
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

/**
 * List rooms for the signed-in staff member (Admin SDK). Avoids fragile Firestore list-rule certification.
 */
exports.staffListRooms = functions.region(REGION).https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }
        const uid = context.auth.uid;
        const { hotelId } = await requireStaffHotelContext(uid);
        const roomDocs = await fetchRoomsForHotelAdmin(hotelId);
        const rooms = roomDocs.map((d) => serializeDocDeep(d));
        rooms.sort((a, b) => {
            const ra = parseInt(String(a.roomNumber), 10) || 0;
            const rb = parseInt(String(b.roomNumber), 10) || 0;
            return ra - rb;
        });
        return { success: true, rooms };
    } catch (error) {
        console.error('Error in staffListRooms:', error);
        if (isHttpsError(error)) {
            throw error;
        }
        wrapUnexpectedError(error, 'Could not list rooms');
    }
});

/**
 * List guests for the staff member's hotel (Admin SDK).
 */
exports.staffListGuests = functions.region(REGION).https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }
        const uid = context.auth.uid;
        const { hotelId } = await requireStaffHotelContext(uid);
        const guestDocs = await fetchGuestsForHotelAdmin(hotelId);
        const guests = guestDocs.map((d) => serializeDocDeep(d));
        guests.sort((a, b) => {
            const ca = typeof a.createdAt === 'number' ? a.createdAt : 0;
            const cb = typeof b.createdAt === 'number' ? b.createdAt : 0;
            return cb - ca;
        });
        return { success: true, guests };
    } catch (error) {
        console.error('Error in staffListGuests:', error);
        if (isHttpsError(error)) {
            throw error;
        }
        wrapUnexpectedError(error, 'Could not list guests');
    }
});

/**
 * Staff action history for the signed-in user at their hotel (Admin SDK). Single-field query + filter.
 */
exports.staffListMyStaffActions = functions.region(REGION).https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }
        const uid = context.auth.uid;
        const { hotelId } = await requireStaffHotelContext(uid);
        const snap = await admin.firestore().collection('staff_actions').where('hotelId', '==', hotelId).limit(200).get();
        const actions = snap.docs
            .map((d) => serializeDocDeep(d))
            .filter((row) => row.staffId === uid)
            .sort((a, b) => {
                const ta = typeof a.timestamp === 'number' ? a.timestamp : 0;
                const tb = typeof b.timestamp === 'number' ? b.timestamp : 0;
                return tb - ta;
            })
            .slice(0, 50);
        return { success: true, actions };
    } catch (error) {
        console.error('Error in staffListMyStaffActions:', error);
        if (isHttpsError(error)) {
            throw error;
        }
        wrapUnexpectedError(error, 'Could not list staff actions');
    }
});

/**
 * Staff room status / guest fields (Admin SDK). Avoids Firestore rules failing on string vs Reference hotelId.
 */
exports.staffUpdateRoom = functions.region(REGION).https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }
        const uid = context.auth.uid;
        const { hotelId } = await requireStaffHotelContext(uid);
        const payload = data || {};
        const roomId = trimStr(payload.roomId);
        const newStatus = trimStr(payload.status);
        if (!roomId || !newStatus) {
            throw new functions.https.HttpsError('invalid-argument', 'roomId and status are required');
        }

        const roomRef = admin.firestore().collection('rooms').doc(roomId);
        const roomSnap = await roomRef.get();
        if (!roomSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'Room not found');
        }
        const roomHotelId = coerceHotelIdForAdmin(roomSnap.data().hotelId);
        if (!roomHotelId || roomHotelId !== hotelId) {
            throw new functions.https.HttpsError('permission-denied', 'Room does not belong to your hotel');
        }

        const room = roomSnap.data();
        const roomRate = coerceMoney(room.price, null);
        const update = {
            status: newStatus,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: uid,
        };

        const batch = admin.firestore().batch();

        if (newStatus === 'checked-in' && payload.guestInfo && typeof payload.guestInfo === 'object') {
            update.guestInfo = payload.guestInfo;
            update.checkInDate = admin.firestore.FieldValue.serverTimestamp();

            // Persist stay history so owner can see it after checkout (rooms.guestInfo may be cleared).
            const stayRef = admin.firestore().collection('stays').doc();
            update.activeStayId = stayRef.id;
            const planned = toEpochMs(payload.guestInfo.checkOutDate);
            batch.set(
                stayRef,
                stripUndefined({
                    hotelId: roomHotelId,
                    roomId,
                    roomNumber: room.roomNumber || null,
                    status: 'checked-in',
                    guestName: payload.guestInfo.guestName || null,
                    guestEmail: payload.guestInfo.guestEmail || null,
                    guestPhone: payload.guestInfo.guestPhone || null,
                    guestUid: payload.guestInfo.guestUid || null,
                    numberOfGuests: payload.guestInfo.numberOfGuests || null,
                    checkInAt: admin.firestore.FieldValue.serverTimestamp(),
                    plannedCheckOutAt: planned ? new Date(planned) : null,
                    checkOutAt: null,
                    roomRate,
                    currency: 'INR',
                    nights: null,
                    roomSubtotal: null,
                    additionalCharges: null,
                    discount: null,
                    tax: null,
                    totalAmount: null,
                    additionalCharges: null,
                    idDocumentType: payload.guestInfo.idDocumentType || null,
                    idDocumentNumber: payload.guestInfo.idDocumentNumber || payload.guestInfo.guestId || null,
                    idDocumentImages: Array.isArray(payload.guestInfo.idDocumentImages) ? payload.guestInfo.idDocumentImages : null,
                    createdBy: uid,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                }),
            );
        }
        if (newStatus === 'checked-out') {
            const activeStayId = trimStr(room.activeStayId);
            update.guestInfo = null;
            update.checkOutDate = admin.firestore.FieldValue.serverTimestamp();
            update.activeStayId = null;

            const extra = payload.additionalCharges != null ? coerceMoney(payload.additionalCharges, 0) : 0;
            const extraReason = trimStr(payload.additionalChargeReason) || null;
            // If client passes amount explicitly, treat it as override of computed room subtotal.
            const overrideAmount = payload.amount != null ? coerceMoney(payload.amount, null) : null;

            if (activeStayId) {
                const stayRef = admin.firestore().collection('stays').doc(activeStayId);
                const staySnap = await stayRef.get();
                const checkInMs = staySnap.exists ? toEpochMs(staySnap.data().checkInAt) : null;
                const checkOutMs = Date.now();
                const nights = computeNights(checkInMs || checkOutMs, checkOutMs);
                const effectiveRate = staySnap.exists ? coerceMoney(staySnap.data().roomRate, roomRate) : roomRate;
                const roomSubtotal = overrideAmount != null ? overrideAmount : (effectiveRate != null ? effectiveRate * nights : null);
                const totalAmount = roomSubtotal != null ? coerceMoney(roomSubtotal + extra, null) : extra;
                batch.update(
                    stayRef,
                    stripUndefined({
                        status: 'checked-out',
                        checkOutAt: admin.firestore.FieldValue.serverTimestamp(),
                        roomRate: effectiveRate,
                        currency: 'INR',
                        nights,
                        roomSubtotal,
                        updatedBy: uid,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        additionalCharges: extra,
                        additionalChargeReason: extraReason,
                        totalAmount,
                    }),
                );
            } else if (room.guestInfo && typeof room.guestInfo === 'object') {
                // Fallback: if room has no activeStayId (legacy), still write a closed stay entry.
                const stayRef = admin.firestore().collection('stays').doc();
                const checkInMs = toEpochMs(room.guestInfo.checkedInAt) || Date.now();
                const checkOutMs = Date.now();
                const nights = computeNights(checkInMs, checkOutMs);
                const roomSubtotal = overrideAmount != null ? overrideAmount : (roomRate != null ? roomRate * nights : null);
                const totalAmount = roomSubtotal != null ? coerceMoney(roomSubtotal + extra, null) : extra;
                batch.set(
                    stayRef,
                    stripUndefined({
                        hotelId: roomHotelId,
                        roomId,
                        roomNumber: room.roomNumber || null,
                        status: 'checked-out',
                        guestName: room.guestInfo.guestName || null,
                        guestEmail: room.guestInfo.guestEmail || null,
                        guestPhone: room.guestInfo.guestPhone || null,
                        guestUid: room.guestInfo.guestUid || null,
                        numberOfGuests: room.guestInfo.numberOfGuests || null,
                        checkInAt: room.guestInfo.checkedInAt || null,
                        checkOutAt: admin.firestore.FieldValue.serverTimestamp(),
                        plannedCheckOutAt: null,
                        roomRate,
                        currency: 'INR',
                        nights,
                        roomSubtotal,
                        additionalCharges: extra,
                        additionalChargeReason: extraReason,
                        discount: null,
                        tax: null,
                        totalAmount,
                        idDocumentType: room.guestInfo.idDocumentType || null,
                        idDocumentNumber: room.guestInfo.idDocumentNumber || room.guestInfo.guestId || null,
                        idDocumentImages: Array.isArray(room.guestInfo.idDocumentImages) ? room.guestInfo.idDocumentImages : null,
                        createdBy: uid,
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    }),
                );
            }

            // Revenue is recognized on checkout: write a checkout ledger row.
            const baseAmount = overrideAmount;
            const totalAmount = baseAmount != null ? coerceMoney(baseAmount + extra, null) : extra;
            const coRef = admin.firestore().collection('checkouts').doc();
            batch.set(
                coRef,
                stripUndefined({
                    guestId: room.guestInfo?.guestUid || null,
                    hotelId: roomHotelId,
                    guestName: room.guestInfo?.guestName || null,
                    guestEmail: room.guestInfo?.guestEmail || null,
                    guestPhone: room.guestInfo?.guestPhone || null,
                    roomNumber: room.roomNumber || null,
                    checkOutDate: admin.firestore.FieldValue.serverTimestamp(),
                    amount: baseAmount,
                    additionalCharges: extra,
                    additionalChargeReason: extraReason,
                    totalAmount,
                    staffId: uid,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                }),
            );
        }

        const roomNumber = room.roomNumber;
        const actionType =
            newStatus === 'checked-in'
                ? 'guest_checkin'
                : newStatus === 'checked-out'
                    ? 'guest_checkout'
                    : 'room_status_change';
        let description = `Changed Room ${roomNumber} status to ${newStatus}`;
        if (newStatus === 'checked-in' && payload.guestInfo && payload.guestInfo.guestName) {
            description = `Checked in guest ${payload.guestInfo.guestName} to Room ${roomNumber}`;
        } else if (newStatus === 'checked-out') {
            description = `Checked out guest from Room ${roomNumber}`;
        }

        batch.update(roomRef, stripUndefined(update));
        const actionRef = admin.firestore().collection('staff_actions').doc();
        batch.set(
            actionRef,
            stripUndefined({
                staffId: uid,
                hotelId: roomHotelId,
                roomId,
                roomNumber,
                actionType,
                description,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                guestInfo:
                    newStatus === 'checked-in' && payload.guestInfo && typeof payload.guestInfo === 'object'
                        ? payload.guestInfo
                        : null,
            }),
        );

        await batch.commit();

        const updated = await roomRef.get();
        return { success: true, room: serializeDocDeep(updated) };
    } catch (error) {
        console.error('Error in staffUpdateRoom:', error);
        if (isHttpsError(error)) {
            throw error;
        }
        wrapUnexpectedError(error, 'Could not update room');
    }
});

/**
 * List rooms for the signed-in hotel owner (Admin SDK). Merges string + Reference hotelId queries.
 */
exports.ownerListRooms = functions.region(REGION).https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }
        const uid = context.auth.uid;
        const userSnap = await admin.firestore().collection('users').doc(uid).get();
        if (!userSnap.exists || userSnap.data().role !== 'hotel_owner') {
            throw new functions.https.HttpsError('permission-denied', 'Only hotel owners can use this.');
        }
        const hotelId = await getHotelIdForOwnerUid(uid);
        if (!hotelId) {
            throw new functions.https.HttpsError('not-found', 'No hotel found for this owner.');
        }
        const roomDocs = await fetchRoomsForHotelAdmin(hotelId);
        const rooms = roomDocs.map((d) => serializeDocDeep(d));
        rooms.sort((a, b) => {
            const ra = parseInt(String(a.roomNumber), 10) || 0;
            const rb = parseInt(String(b.roomNumber), 10) || 0;
            return ra - rb;
        });
        return { success: true, rooms };
    } catch (error) {
        console.error('Error in ownerListRooms:', error);
        if (isHttpsError(error)) {
            throw error;
        }
        wrapUnexpectedError(error, 'Could not list rooms');
    }
});

/**
 * List guest stay records for owner (Admin SDK). Merges string + Reference hotelId on `guests` docs.
 */
exports.ownerListGuests = functions.region(REGION).https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }
        const uid = context.auth.uid;
        const userSnap = await admin.firestore().collection('users').doc(uid).get();
        if (!userSnap.exists || userSnap.data().role !== 'hotel_owner') {
            throw new functions.https.HttpsError('permission-denied', 'Only hotel owners can use this.');
        }
        const hotelId = await getHotelIdForOwnerUid(uid);
        if (!hotelId) {
            throw new functions.https.HttpsError('not-found', 'No hotel found for this owner.');
        }
        const guestDocs = await fetchGuestsForHotelAdmin(hotelId);
        const guests = guestDocs.map((d) => serializeDocDeep(d));
        guests.sort((a, b) => {
            const ca = typeof a.createdAt === 'number' ? a.createdAt : 0;
            const cb = typeof b.createdAt === 'number' ? b.createdAt : 0;
            return cb - ca;
        });
        return { success: true, guests };
    } catch (error) {
        console.error('Error in ownerListGuests:', error);
        if (isHttpsError(error)) {
            throw error;
        }
        wrapUnexpectedError(error, 'Could not list guest records');
    }
});

/**
 * Staff: look up a registered guest user by email or phone to reuse saved ID images.
 */
exports.staffLookupGuestProfile = functions.region(REGION).https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }
        await requireStaffHotelContext(context.auth.uid);

        const payload = data || {};
        const email = normalizeEmailLookup(payload.email);
        const phoneRaw = trimStr(payload.phone);
        if (!email && !phoneRaw) {
            throw new functions.https.HttpsError('invalid-argument', 'Provide email or phone to look up a guest account.');
        }

        const db = admin.firestore();
        const seen = new Set();
        const candidates = [];

        if (email) {
            const snap = await db.collection('users').where('email', '==', email).limit(20).get();
            snap.docs.forEach((d) => {
                if (!seen.has(d.id)) {
                    seen.add(d.id);
                    candidates.push(d);
                }
            });
        }
        if (phoneRaw) {
            const variants = [...new Set([phoneRaw, phoneRaw.replace(/\D/g, '')])].filter(Boolean);
            for (const v of variants) {
                const snap = await db.collection('users').where('phoneNumber', '==', v).limit(20).get();
                snap.docs.forEach((d) => {
                    if (!seen.has(d.id)) {
                        seen.add(d.id);
                        candidates.push(d);
                    }
                });
            }
        }

        const guestDoc = candidates.find((d) => d.data().role === 'guest');
        if (!guestDoc) {
            return { found: false };
        }
        const d = guestDoc.data();
        const idDocuments = Array.isArray(d.idDocuments)
            ? d.idDocuments.map((item) => serializeForJson(item))
            : [];
        return {
            found: true,
            profile: {
                uid: guestDoc.id,
                displayName: d.displayName || null,
                email: d.email || null,
                phoneNumber: d.phoneNumber || null,
                idDocuments,
            },
        };
    } catch (error) {
        console.error('Error in staffLookupGuestProfile:', error);
        if (isHttpsError(error)) {
            throw error;
        }
        wrapUnexpectedError(error, 'Could not look up guest profile');
    }
});

/**
 * List stay history for owner (Admin SDK). Used to show guest history after checkout.
 */
exports.ownerListStays = functions.region(REGION).https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }
        const uid = context.auth.uid;
        const userSnap = await admin.firestore().collection('users').doc(uid).get();
        if (!userSnap.exists || userSnap.data().role !== 'hotel_owner') {
            throw new functions.https.HttpsError('permission-denied', 'Only hotel owners can use this.');
        }
        const hotelId = await getHotelIdForOwnerUid(uid);
        if (!hotelId) {
            throw new functions.https.HttpsError('not-found', 'No hotel found for this owner.');
        }
        const stayDocs = await fetchStaysForHotelAdmin(hotelId);
        const stays = stayDocs.map((d) => serializeDocDeep(d));
        stays.sort((a, b) => {
            const ta = typeof a.checkInAt === 'number' ? a.checkInAt : 0;
            const tb = typeof b.checkInAt === 'number' ? b.checkInAt : 0;
            return tb - ta;
        });
        return { success: true, stays };
    } catch (error) {
        console.error('Error in ownerListStays:', error);
        if (isHttpsError(error)) {
            throw error;
        }
        wrapUnexpectedError(error, 'Could not list stays');
    }
});

/**
 * Backfill totals for stays that were created before billing fields existed.
 * Safe to run multiple times.
 *
 * Payload:
 *   { limit?: number }
 */
exports.superAdminBackfillStayTotals = functions.region(REGION).https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }
        const uid = context.auth.uid;
        const userSnap = await admin.firestore().collection('users').doc(uid).get();
        if (!userSnap.exists || userSnap.data().role !== 'super_admin') {
            throw new functions.https.HttpsError('permission-denied', 'Only super admins can run backfills.');
        }

        const limitN = safeNonNegativeInt(data?.limit, 200);
        const snap = await admin.firestore()
            .collection('stays')
            .where('checkOutAt', '!=', null)
            .limit(limitN)
            .get();

        let scanned = 0;
        let updated = 0;
        const batch = admin.firestore().batch();

        snap.docs.forEach((docSnap) => {
            scanned += 1;
            const s = docSnap.data() || {};
            if (s.totalAmount != null && s.roomSubtotal != null && s.nights != null) {
                return;
            }
            const checkInMs = toEpochMs(s.checkInAt);
            const checkOutMs = toEpochMs(s.checkOutAt);
            const nights = computeNights(checkInMs || checkOutMs || Date.now(), checkOutMs || Date.now());
            const roomRate = coerceMoney(s.roomRate, null);
            const extra = coerceMoney(s.additionalCharges, 0) || 0;
            const roomSubtotal = roomRate != null ? coerceMoney(roomRate * nights, null) : null;
            const totalAmount = roomSubtotal != null ? coerceMoney(roomSubtotal + extra, null) : extra;
            batch.update(docSnap.ref, stripUndefined({ nights, roomSubtotal, totalAmount, currency: s.currency || 'INR' }));
            updated += 1;
        });

        if (updated > 0) {
            await batch.commit();
        }

        return { success: true, scanned, updated };
    } catch (error) {
        console.error('Error in superAdminBackfillStayTotals:', error);
        if (isHttpsError(error)) throw error;
        wrapUnexpectedError(error, 'Backfill failed');
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

        if (coerceHotelIdForAdmin(staffDoc.data().hotelId) !== hotelId) {
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
        // Always return HttpsError so the client gets functions/failed-precondition + message,
        // not a generic functions/internal when the runtime wraps raw throws.
        const mapped = mapKnownBackendError(error);
        const raw = mapped || (error && error.message ? error.message : String(error));
        throw new functions.https.HttpsError(
            'failed-precondition',
            truncateForClient(`Could not create hotel: ${raw}`),
        );
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
