import {
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    query,
    where,
} from "firebase/firestore";
import { db } from "../firebase/config";

async function hotelIsOwnedBy(hotelId, authUid) {
    if (!hotelId || !authUid) return false;
    const snap = await getDoc(doc(db, "hotels", hotelId));
    return snap.exists() && snap.data()?.ownerId === authUid;
}

/**
 * Resolve the Firestore hotel document id for a hotel_owner.
 * Cloud Functions set hotels.ownerId to the Firebase Auth UID (superAdminCreateHotel).
 *
 * Important: we never trust users.{uid}.hotelId unless that hotel's ownerId matches Auth UID.
 * Otherwise manual Console edits (wrong ownerId on the hotel doc) cause room writes to fail rules.
 */
export async function resolveHotelIdForOwner(authUid) {
    if (!authUid) return null;

    const hotelSnap = await getDocs(
        query(
            collection(db, "hotels"),
            where("ownerId", "==", authUid),
            limit(1),
        ),
    );
    const fromOwnerQuery = hotelSnap.docs[0]?.id ?? null;
    if (fromOwnerQuery) return fromOwnerQuery;

    const userByUidDoc = await getDoc(doc(db, "users", authUid));
    if (userByUidDoc.exists()) {
        const hid = userByUidDoc.data()?.hotelId;
        if (hid && (await hotelIsOwnedBy(hid, authUid))) return hid;
    }

    const legacySnap = await getDocs(
        query(
            collection(db, "users"),
            where("uid", "==", authUid),
            limit(1),
        ),
    );
    const legacyHid = legacySnap.docs[0]?.data()?.hotelId;
    if (legacyHid && (await hotelIsOwnedBy(legacyHid, authUid))) return legacyHid;

    return null;
}
