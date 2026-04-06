import { guestIdentityKey, normalizeEmail, normalizePhoneDigits } from "./idDocuments";

function toMillis(value) {
    if (value == null) return 0;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (value.toDate) return value.toDate().getTime();
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

/**
 * Merge room `guestInfo` rows with front-desk `guests` collection docs for owner Guest Management.
 * @param {Array<{id:string, guestInfo?:object, roomNumber?:string, status?:string}>} roomsData
 * @param {Array<object>} ledgerGuests — serialized guest stay documents
 * @param {Array<object>} staysData — serialized stays docs
 */
export function mergeOwnerGuestView(roomsData, ledgerGuests, staysData = []) {
    const guestMap = new Map();

    const ensure = (key, base) => {
        if (!guestMap.has(key)) {
            guestMap.set(key, { ...base, stays: [] });
        }
        return guestMap.get(key);
    };

    roomsData.forEach((room) => {
        if (!room.guestInfo) return;
        const gi = room.guestInfo;
        const key =
            guestIdentityKey(gi.guestEmail, gi.guestPhone) ||
            `room_only_${room.id}_${gi.guestPhone || gi.guestEmail || "anon"}`;

        const row = ensure(key, {
            id: key,
            guestName: gi.guestName || "Guest",
            guestEmail: gi.guestEmail || "",
            guestPhone: gi.guestPhone || "",
            guestId: gi.guestId || "",
            numberOfGuests: gi.numberOfGuests || 1,
            stayCount: 0,
            currentRoom: room.roomNumber,
            isCurrentlyCheckedIn: false,
        });
        row.stayCount += 1;
        row.stays.push({
            roomNumber: room.roomNumber,
            checkInDate: gi.checkInDate,
            checkOutDate: gi.checkOutDate,
            checkedInAt: gi.checkedInAt,
            checkedInBy: gi.checkedInBy,
            specialRequests: gi.specialRequests,
            roomStatus: room.status,
            source: "room",
            idDocumentType: gi.idDocumentType,
            idDocumentImages: gi.idDocumentImages,
            idProof: gi.idDocumentNumber || gi.guestId,
        });
    });

    ledgerGuests.forEach((g) => {
        const name = g.guestName || g.name || "Guest";
        const email = g.email || g.guestEmail || "";
        const phone = g.phoneNumber || g.guestPhone || "";
        const key =
            guestIdentityKey(email, phone) ||
            `ledger_${g.id}`;

        const row = ensure(key, {
            id: key,
            guestName: name,
            guestEmail: email,
            guestPhone: phone,
            guestId: g.idProof || g.idDocumentNumber || g.guestId || "",
            numberOfGuests: g.numberOfGuests || 1,
            stayCount: 0,
            currentRoom: g.roomNumber || "",
            isCurrentlyCheckedIn: false,
        });
        row.stayCount += 1;
        row.stays.push({
            roomNumber: g.roomNumber,
            checkInDate: g.checkInDate,
            checkOutDate: g.checkOutDate,
            checkedInAt: g.createdAt,
            checkedInBy: g.createdBy,
            specialRequests: g.address || g.specialRequests,
            roomStatus: g.isCheckedIn ? "checked-in" : "checked-out",
            source: "front-desk",
            idDocumentType: g.idDocumentType,
            idProof: g.idProof,
            idDocumentImages: g.idDocumentImages,
            ledgerGuestId: g.id,
        });
    });

    staysData.forEach((s) => {
        const email = s.guestEmail || "";
        const phone = s.guestPhone || "";
        const key =
            guestIdentityKey(email, phone) ||
            (s.guestUid ? `guest_${s.guestUid}` : `stay_${s.id}`);

        const row = ensure(key, {
            id: key,
            guestName: s.guestName || "Guest",
            guestEmail: email,
            guestPhone: phone,
            guestId: s.idDocumentNumber || "",
            numberOfGuests: s.numberOfGuests || 1,
            stayCount: 0,
            currentRoom: s.roomNumber || "",
            isCurrentlyCheckedIn: false,
        });
        row.stayCount += 1;
        row.stays.push({
            roomNumber: s.roomNumber,
            checkInDate: s.checkInAt,
            checkOutDate: s.checkOutAt,
            checkedInAt: s.checkInAt,
            checkedInBy: s.createdBy,
            specialRequests: null,
            roomStatus: s.status || (s.checkOutAt ? "checked-out" : "checked-in"),
            source: "stay-history",
            amount: s.amount,
            additionalCharges: s.additionalCharges,
            idDocumentType: s.idDocumentType,
            idProof: s.idDocumentNumber,
            idDocumentImages: s.idDocumentImages,
            stayId: s.id,
        });
    });

    guestMap.forEach((row) => {
        const checkedInStays = row.stays.filter(
            (s) => s.roomStatus === "checked-in" || s.roomStatus === "occupied",
        );
        row.isCurrentlyCheckedIn = checkedInStays.length > 0;
        const lastRoom = [...row.stays].sort((a, b) => toMillis(b.checkedInAt) - toMillis(a.checkedInAt))[0];
        if (lastRoom) {
            row.currentRoom = lastRoom.roomNumber || row.currentRoom;
        }
    });

    return Array.from(guestMap.values()).sort(
        (a, b) => toMillis(b.stays[b.stays.length - 1]?.checkedInAt) - toMillis(a.stays[a.stays.length - 1]?.checkedInAt),
    );
}
