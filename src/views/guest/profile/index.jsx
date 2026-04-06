import React, { useState, useEffect, useCallback, useRef } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../../firebase/config";
import { useAuth } from "contexts/AuthContext";
import InputField from "components/fields/InputField";
import { ID_DOCUMENT_TYPES, idDocumentTypeLabel } from "utils/idDocuments";
import { uploadGuestProfileIdImage } from "utils/storageUpload";
import {
    MdPerson,
    MdEmail,
    MdPhone,
    MdEdit,
    MdSave,
    MdCancel,
    MdCameraAlt,
    MdDelete,
} from "react-icons/md";

const Profile = () => {
    const { currentUser } = useAuth();
    const [profile, setProfile] = useState({
        displayName: '',
        email: '',
        phoneNumber: '',
        photoURL: ''
    });
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [idDocuments, setIdDocuments] = useState([]);
    const [newIdType, setNewIdType] = useState("aadhaar");
    const [idUploadBusy, setIdUploadBusy] = useState(false);
    const idFileRef = useRef(null);

    const fetchProfile = useCallback(async () => {
        try {
            setLoading(true);
            const userDoc = await getDoc(doc(db, "users", currentUser.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                setProfile({
                    displayName: userData.displayName || currentUser.displayName || '',
                    email: userData.email || currentUser.email || '',
                    phoneNumber: userData.phoneNumber || currentUser.phoneNumber || '',
                    photoURL: userData.photoURL || currentUser.photoURL || ''
                });
                setIdDocuments(Array.isArray(userData.idDocuments) ? userData.idDocuments : []);
            }
        } catch (error) {
            console.error("Error fetching profile:", error);
        } finally {
            setLoading(false);
        }
    }, [currentUser]);

    useEffect(() => {
        if (currentUser) {
            fetchProfile();
        }
    }, [currentUser, fetchProfile]);

    const handleSave = async () => {
        try {
            setSaving(true);
            await updateDoc(doc(db, "users", currentUser.uid), {
                displayName: profile.displayName,
                email: String(profile.email || "").trim().toLowerCase(),
                phoneNumber: String(profile.phoneNumber || "").trim(),
                photoURL: profile.photoURL,
                updatedAt: new Date()
            });
            setEditing(false);
        } catch (error) {
            console.error("Error updating profile:", error);
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        setEditing(false);
        fetchProfile(); // Reset to original values
    };

    const handleIdFile = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file || !currentUser?.uid) return;
        setIdUploadBusy(true);
        try {
            const { downloadURL, storagePath } = await uploadGuestProfileIdImage(
                currentUser.uid,
                file,
                newIdType,
            );
            const userRef = doc(db, "users", currentUser.uid);
            const snap = await getDoc(userRef);
            const prev = snap.exists() && Array.isArray(snap.data().idDocuments) ? snap.data().idDocuments : [];
            const next = [
                ...prev,
                {
                    type: newIdType,
                    downloadURL,
                    storagePath,
                    uploadedAt: new Date(),
                },
            ];
            await updateDoc(userRef, { idDocuments: next, updatedAt: new Date() });
            setIdDocuments(next);
        } catch (err) {
            console.error(err);
            alert(err?.message || "Could not upload ID image. Deploy Storage rules and try again.");
        } finally {
            setIdUploadBusy(false);
        }
    };

    const removeIdDocument = async (index) => {
        if (!currentUser?.uid) return;
        const next = idDocuments.filter((_, i) => i !== index);
        try {
            await updateDoc(doc(db, "users", currentUser.uid), {
                idDocuments: next,
                updatedAt: new Date(),
            });
            setIdDocuments(next);
        } catch (err) {
            console.error(err);
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-brand-500"></div>
            </div>
        );
    }

    return (
        <div>
            <div className="mt-6 mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-navy-700 dark:text-white">
                    My Profile
                </h2>
                {!editing ? (
                    <button
                        onClick={() => setEditing(true)}
                        className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-white hover:bg-brand-600"
                    >
                        <MdEdit className="h-4 w-4" />
                        Edit Profile
                    </button>
                ) : (
                    <div className="flex gap-2">
                        <button
                            onClick={handleCancel}
                            className="flex items-center gap-2 rounded-lg bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300"
                        >
                            <MdCancel className="h-4 w-4" />
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 rounded-lg bg-green-500 px-4 py-2 text-white hover:bg-green-600 disabled:opacity-50"
                        >
                            <MdSave className="h-4 w-4" />
                            {saving ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                )}
            </div>

            <div className="max-w-2xl">
                {/* Profile Picture */}
                <div className="mb-6 text-center">
                    <div className="mx-auto h-24 w-24 rounded-full bg-gray-200 flex items-center justify-center">
                        {profile.photoURL ? (
                            <img
                                src={profile.photoURL}
                                alt="Profile"
                                className="h-24 w-24 rounded-full object-cover"
                            />
                        ) : (
                            <MdPerson className="h-12 w-12 text-gray-400" />
                        )}
                    </div>
                    {editing && (
                        <button className="mt-2 text-sm text-brand-500 hover:text-brand-600">
                            Change Photo
                        </button>
                    )}
                </div>

                {/* Profile Form */}
                <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <InputField
                            label="Full Name"
                            placeholder="Enter your full name"
                            value={profile.displayName}
                            onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
                            disabled={!editing}
                            icon={<MdPerson className="h-5 w-5 text-gray-400" />}
                        />

                        <InputField
                            label="Email"
                            type="email"
                            placeholder="Enter your email"
                            value={profile.email}
                            onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                            disabled={!editing}
                            icon={<MdEmail className="h-5 w-5 text-gray-400" />}
                        />

                        <InputField
                            label="Phone Number"
                            type="tel"
                            placeholder="Enter your phone number"
                            value={profile.phoneNumber}
                            onChange={(e) => setProfile({ ...profile, phoneNumber: e.target.value })}
                            disabled={!editing}
                            icon={<MdPhone className="h-5 w-5 text-gray-400" />}
                        />
                    </div>

                    {/* Saved ID documents (used when staff checks you in with this email or phone) */}
                    <div className="rounded-lg bg-gray-50 p-6 dark:bg-navy-800">
                        <h3 className="mb-2 text-lg font-semibold text-navy-700 dark:text-white">
                            Government ID on file
                        </h3>
                        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                            Upload Aadhaar, driving licence, voter ID, or passport. Staff can pull these when they enter
                            your email or phone at check-in.
                        </p>
                        <div className="mb-4 flex flex-wrap items-end gap-3">
                            <div>
                                <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Document type</label>
                                <select
                                    value={newIdType}
                                    onChange={(e) => setNewIdType(e.target.value)}
                                    className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-navy-600 dark:bg-navy-900 dark:text-white"
                                >
                                    {ID_DOCUMENT_TYPES.map((t) => (
                                        <option key={t.value} value={t.value}>
                                            {t.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <input
                                ref={idFileRef}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="hidden"
                                onChange={handleIdFile}
                            />
                            <button
                                type="button"
                                disabled={idUploadBusy}
                                onClick={() => idFileRef.current?.click()}
                                className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm text-white hover:bg-brand-600 disabled:opacity-50"
                            >
                                <MdCameraAlt className="h-5 w-5" />
                                {idUploadBusy ? "Uploading…" : "Take photo / upload"}
                            </button>
                        </div>
                        {idDocuments.length === 0 ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400">No ID images saved yet.</p>
                        ) : (
                            <ul className="space-y-3">
                                {idDocuments.map((docu, idx) => (
                                    <li
                                        key={`${docu.storagePath || docu.downloadURL}-${idx}`}
                                        className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-navy-600 dark:bg-navy-900"
                                    >
                                        <a
                                            href={docu.downloadURL}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="h-16 w-16 shrink-0 overflow-hidden rounded-md border"
                                        >
                                            <img
                                                src={docu.downloadURL}
                                                alt=""
                                                className="h-full w-full object-cover"
                                            />
                                        </a>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium text-navy-700 dark:text-white">
                                                {idDocumentTypeLabel(docu.type)}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeIdDocument(idx)}
                                            className="shrink-0 rounded p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                            title="Remove"
                                        >
                                            <MdDelete className="h-5 w-5" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Account Information */}
                    <div className="rounded-lg bg-gray-50 p-6 dark:bg-navy-800">
                        <h3 className="mb-4 text-lg font-semibold text-navy-700 dark:text-white">
                            Account Information
                        </h3>
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <span className="text-sm font-medium text-gray-600">User ID</span>
                                <span className="text-sm text-navy-700 dark:text-white font-mono">
                                    {currentUser.uid}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm font-medium text-gray-600">Role</span>
                                <span className="text-sm text-navy-700 dark:text-white">Guest</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm font-medium text-gray-600">Account Created</span>
                                <span className="text-sm text-navy-700 dark:text-white">
                                    {currentUser.metadata?.creationTime ?
                                        new Date(currentUser.metadata.creationTime).toLocaleDateString() :
                                        'N/A'
                                    }
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Preferences */}
                    <div className="rounded-lg bg-gray-50 p-6 dark:bg-navy-800">
                        <h3 className="mb-4 text-lg font-semibold text-navy-700 dark:text-white">
                            Preferences
                        </h3>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-600">Email Notifications</span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" defaultChecked />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 dark:peer-focus:ring-brand-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-brand-600"></div>
                                </label>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-600">SMS Notifications</span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 dark:peer-focus:ring-brand-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-brand-600"></div>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Profile;
