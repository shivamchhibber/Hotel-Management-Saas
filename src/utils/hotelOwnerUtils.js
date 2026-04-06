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

function coerceHotelIdField(raw) {
    if (raw == null || raw === "") return null;
    if (typeof raw === "string") {
        const t = raw.trim();
        return t || null;
    }
    if (typeof raw === "object" && typeof raw.id === "string") {
        return raw.id;
    }
    return null;
}

async function hotelIsOwnedBy(hotelId, authUid) {
    const id = coerceHotelIdField(hotelId);
    if (!id || !authUid) return false;
    const snap = await getDoc(doc(db, "hotels", id));
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

    // Prefer profile hotelId (same as Cloud Functions getHotelIdForOwnerUid) so rooms/staff stay on one hotel.
    const userByUidDoc = await getDoc(doc(db, "users", authUid));
    if (userByUidDoc.exists()) {
        const hid = coerceHotelIdField(userByUidDoc.data()?.hotelId);
        if (hid && (await hotelIsOwnedBy(hid, authUid))) return hid;
    }

    const hotelSnap = await getDocs(
        query(
            collection(db, "hotels"),
            where("ownerId", "==", authUid),
            limit(1),
        ),
    );
    const fromOwnerQuery = hotelSnap.docs[0]?.id ?? null;
    if (fromOwnerQuery) return fromOwnerQuery;

    const legacySnap = await getDocs(
        query(
            collection(db, "users"),
            where("uid", "==", authUid),
            limit(1),
        ),
    );
    const legacyHid = coerceHotelIdField(legacySnap.docs[0]?.data()?.hotelId);
    if (legacyHid && (await hotelIsOwnedBy(legacyHid, authUid))) return legacyHid;

    return null;
}
