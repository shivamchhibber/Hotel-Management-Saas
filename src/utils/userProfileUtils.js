import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/config";

function coerceHotelIdField(raw) {
    if (raw == null || raw === "") return null;
    if (typeof raw === "string") {
        const t = raw.trim();
        return t || null;
    }
    // Firestore DocumentReference — rules compare to string hotel id on room docs
    if (typeof raw === "object" && typeof raw.id === "string") {
        return raw.id;
    }
    return null;
}

/**
 * Load `users/{authUid}` by document id (not a collection query).
 * Staff views used `where("uid", "==", uid)` which Firestore often denies under rules that only
 * allow self-read via path `users/{request.auth.uid}` — the query cannot be proven safe.
 */
export async function getHotelIdFromUserProfile(authUid) {
    if (!authUid) return null;
    const snap = await getDoc(doc(db, "users", authUid));
    if (!snap.exists()) return null;
    return coerceHotelIdField(snap.data()?.hotelId);
}
