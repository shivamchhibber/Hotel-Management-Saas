/** Accepted government ID types for Indian hotels (not PAN). */
export const ID_DOCUMENT_TYPES = [
    { value: "aadhaar", label: "Aadhaar card" },
    { value: "driving_license", label: "Driving licence" },
    { value: "voter_id", label: "Voter ID" },
    { value: "passport", label: "Passport" },
];

export function idDocumentTypeLabel(value) {
    return ID_DOCUMENT_TYPES.find((t) => t.value === value)?.label || value || "—";
}

export function normalizeEmail(value) {
    if (value == null || value === "") return "";
    return String(value).trim().toLowerCase();
}

/** Digits only for fuzzy phone match. */
export function normalizePhoneDigits(value) {
    if (value == null || value === "") return "";
    return String(value).replace(/\D/g, "");
}

/**
 * Stable key for merging room guestInfo with front-desk `guests` collection rows.
 */
export function guestIdentityKey(email, phone) {
    const e = normalizeEmail(email);
    const p = normalizePhoneDigits(phone);
    if (!e && !p) return null;
    return `${e}__${p}`;
}
