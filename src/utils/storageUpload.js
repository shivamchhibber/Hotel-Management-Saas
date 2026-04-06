import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase/config";

function safeFileSegment(name) {
    return String(name || "image")
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .slice(0, 80);
}

/** Guest uploads their own ID images (path scoped to auth uid in Storage rules). */
export async function uploadGuestProfileIdImage(userId, file, docType) {
    const path = `guest-profiles/${userId}/ids/${Date.now()}_${safeFileSegment(docType)}_${safeFileSegment(file.name)}`;
    const r = ref(storage, path);
    await uploadBytes(r, file, { contentType: file.type || "image/jpeg" });
    const downloadURL = await getDownloadURL(r);
    return { downloadURL, storagePath: path };
}

/** Staff uploads during check-in (path includes hotel + staff uid for rules). */
export async function uploadStaffCheckinIdImage(hotelId, staffUid, file, docType) {
    const path = `checkin_uploads/${hotelId}/${staffUid}/${Date.now()}_${safeFileSegment(docType)}.jpg`;
    const r = ref(storage, path);
    await uploadBytes(r, file, { contentType: file.type || "image/jpeg" });
    const downloadURL = await getDownloadURL(r);
    return { downloadURL, storagePath: path };
}
