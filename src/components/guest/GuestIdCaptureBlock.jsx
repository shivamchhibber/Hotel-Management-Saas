import React, { useRef, useState } from "react";
import { ID_DOCUMENT_TYPES } from "utils/idDocuments";
import { uploadStaffCheckinIdImage } from "utils/storageUpload";
import { staffLookupGuestProfileFn } from "utils/staffCallables";

/**
 * Government ID type + number + camera/gallery capture + load saved images from guest account (by email/phone).
 */
export default function GuestIdCaptureBlock({
    staffUid,
    hotelId,
    email,
    phone,
    idDocumentType,
    setIdDocumentType,
    idDocumentNumber,
    setIdDocumentNumber,
    idImages,
    setIdImages,
}) {
    const fileInputRef = useRef(null);
    const [lookupMsg, setLookupMsg] = useState("");
    const [lookupBusy, setLookupBusy] = useState(false);
    const [uploadBusy, setUploadBusy] = useState(false);

    const loadFromGuestAccount = async () => {
        setLookupMsg("");
        if (!email?.trim() && !phone?.trim()) {
            setLookupMsg("Enter the guest email or phone first.");
            return;
        }
        setLookupBusy(true);
        try {
            const { data } = await staffLookupGuestProfileFn({
                email: email?.trim() || null,
                phone: phone?.trim() || null,
            });
            if (!data?.found) {
                setLookupMsg("No guest account found for that email or phone.");
                return;
            }
            const docs = Array.isArray(data.profile?.idDocuments) ? data.profile.idDocuments : [];
            const fromProfile = docs
                .filter((d) => d.downloadURL)
                .map((d) => ({
                    url: d.downloadURL,
                    type: d.type || "saved",
                    fromProfile: true,
                }));
            setIdImages((prev) => {
                const keep = prev.filter((x) => !x.fromProfile);
                return [...fromProfile, ...keep];
            });
            setLookupMsg(
                fromProfile.length
                    ? `Loaded ${fromProfile.length} saved image(s) from the guest profile.`
                    : "Guest account found — no ID images on file yet.",
            );
        } catch (err) {
            setLookupMsg(err?.message || "Could not load guest profile.");
        } finally {
            setLookupBusy(false);
        }
    };

    const onPickFiles = async (e) => {
        const files = Array.from(e.target.files || []);
        e.target.value = "";
        if (!files.length || !hotelId || !staffUid) return;
        setUploadBusy(true);
        try {
            for (const file of files) {
                const { downloadURL } = await uploadStaffCheckinIdImage(hotelId, staffUid, file, idDocumentType);
                setIdImages((prev) => [
                    ...prev,
                    { url: downloadURL, type: idDocumentType, fromProfile: false },
                ]);
            }
        } catch (err) {
            console.error(err);
            setLookupMsg(err?.message || "Upload failed. Check Storage rules are deployed.");
        } finally {
            setUploadBusy(false);
        }
    };

    const removeImage = (index) => {
        setIdImages((prev) => prev.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-4 border-t border-gray-200 pt-4 dark:border-navy-600">
            <p className="text-sm font-medium text-navy-700 dark:text-white">Government-issued ID</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
                Accepted: Aadhaar, driving licence, voter ID, or passport (not PAN).
            </p>

            <div>
                <label className="mb-1 block text-sm text-gray-600 dark:text-gray-300">ID type</label>
                <select
                    value={idDocumentType}
                    onChange={(e) => setIdDocumentType(e.target.value)}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-navy-600 dark:bg-navy-900 dark:text-white"
                >
                    {ID_DOCUMENT_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                            {t.label}
                        </option>
                    ))}
                </select>
            </div>

            <div>
                <label className="mb-1 block text-sm text-gray-600 dark:text-gray-300">ID number (optional)</label>
                <input
                    type="text"
                    value={idDocumentNumber}
                    onChange={(e) => setIdDocumentNumber(e.target.value)}
                    placeholder="Last 4 digits or full number as per hotel policy"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-navy-600 dark:bg-navy-900 dark:text-white"
                />
            </div>

            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    disabled={!hotelId || !staffUid || uploadBusy}
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-lg bg-navy-700 px-3 py-2 text-sm text-white hover:bg-navy-800 disabled:opacity-50 dark:bg-navy-600"
                >
                    {uploadBusy ? "Uploading…" : "Camera / upload photo"}
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    className="hidden"
                    onChange={onPickFiles}
                />
                <button
                    type="button"
                    disabled={lookupBusy}
                    onClick={loadFromGuestAccount}
                    className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20"
                >
                    {lookupBusy ? "Loading…" : "Load saved IDs from guest account"}
                </button>
            </div>
            {lookupMsg ? <p className="text-xs text-gray-600 dark:text-gray-400">{lookupMsg}</p> : null}

            {idImages.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {idImages.map((img, i) => (
                        <div key={`${img.url}-${i}`} className="relative h-24 w-24 overflow-hidden rounded-md border">
                            <img src={img.url} alt="" className="h-full w-full object-cover" />
                            <button
                                type="button"
                                onClick={() => removeImage(i)}
                                className="absolute right-0 top-0 bg-black/60 px-1 text-xs text-white"
                            >
                                ×
                            </button>
                            {img.fromProfile ? (
                                <span className="absolute bottom-0 left-0 right-0 bg-black/50 text-center text-[10px] text-white">
                                    From account
                                </span>
                            ) : null}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
