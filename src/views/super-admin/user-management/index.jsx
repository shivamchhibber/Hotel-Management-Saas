import React, { useState, useEffect, useCallback } from "react";
import { getDoc, doc, updateDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../../../firebase/config";
import { useAuth } from "contexts/AuthContext";
import ComplexTable from "views/admin/default/components/ComplexTable";
import {
    MdEdit,
    MdCheckCircle,
    MdCancel,
} from "react-icons/md";
import { normalizeRole, formatRoleLabel } from "utils/roleUtils";
import { formatCallableError } from "utils/callableError";

function createdAtMs(data) {
    const c = data?.createdAt;
    if (c == null) return 0;
    if (typeof c === "number") return c;
    if (typeof c.toMillis === "function") return c.toMillis();
    if (typeof c.toDate === "function") return c.toDate().getTime();
    if (typeof c.seconds === "number") return c.seconds * 1000;
    if (c instanceof Date) return c.getTime();
    return 0;
}

function formatCreatedAtDisplay(value) {
    if (value == null || value === "") return "";
    if (typeof value === "number") return new Date(value).toLocaleString();
    if (typeof value.toDate === "function") return value.toDate().toLocaleString();
    if (typeof value.seconds === "number") return new Date(value.seconds * 1000).toLocaleString();
    return "";
}

const superAdminListUsers = httpsCallable(functions, "superAdminListUsers");

const UserManagement = () => {
    const { currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState("");
    const [selectedUser, setSelectedUser] = useState(null);
    const [showModal, setShowModal] = useState(false);

    const fetchUsers = useCallback(async () => {
        try {
            setLoading(true);
            setFetchError("");
            const result = await superAdminListUsers();
            const list = Array.isArray(result.data?.users) ? result.data.users : [];
            const usersData = list.sort((a, b) => createdAtMs(b) - createdAtMs(a));
            setUsers(usersData);
        } catch (error) {
            console.error("Error fetching users:", error);
            let base = formatCallableError(error, "Could not load users (superAdminListUsers).");
            base +=
                " Super admins need users/{yourAuthUid} with role \"super_admin\".";

            if (currentUser?.uid) {
                try {
                    const selfSnap = await getDoc(doc(db, "users", currentUser.uid));
                    if (!selfSnap.exists()) {
                        base += `\n\nDiagnosis: There is no document at users/${currentUser.uid}. In Firebase Console → Firestore, create a document with that exact ID and set role to "super_admin" (plus email, uid, isActive as needed).`;
                    } else {
                        const rawRole = selfSnap.data()?.role;
                        const norm = normalizeRole(rawRole);
                        if (norm !== "super_admin") {
                            base += `\n\nDiagnosis: users/${currentUser.uid} exists but role is ${JSON.stringify(rawRole)}. Rules expect the string "super_admin" (underscore, lowercase). Update the field and refresh.`;
                        } else {
                            base += `\n\nDiagnosis: Your profile already has role "super_admin". If you still see permission-denied, deploy functions (superAdminListUsers) and confirm REACT_APP_FIREBASE_PROJECT_ID / FUNCTIONS_REGION match this project.`;
                        }
                    }
                } catch (inner) {
                    base += `\n\nCould not read your own profile doc: ${inner?.message || inner}`;
                }
            }

            setFetchError(base);
            setUsers([]);
        } finally {
            setLoading(false);
        }
    }, [currentUser?.uid]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const toggleUserStatus = async (userId, currentStatus) => {
        try {
            const userRef = doc(db, "users", userId);
            await updateDoc(userRef, {
                isActive: !currentStatus,
                updatedAt: new Date()
            });

            // Update local state
            setUsers(users.map(user =>
                user.id === userId
                    ? { ...user, isActive: !currentStatus }
                    : user
            ));
        } catch (error) {
            console.error("Error updating user status:", error);
        }
    };

    const getRoleColor = (role) => {
        const r = normalizeRole(role);
        switch (r) {
            case 'super_admin':
                return 'bg-purple-100 text-purple-800';
            case 'hotel_owner':
                return 'bg-blue-100 text-blue-800';
            case 'hotel_staff':
                return 'bg-green-100 text-green-800';
            case 'guest':
                return 'bg-gray-100 text-gray-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const userColumns = [
        { Header: "Name", accessor: "displayName" },
        { Header: "Email", accessor: "email" },
        { Header: "Role", accessor: "role" },
        { Header: "Active", accessor: "status" },
        { Header: "Created At", accessor: "createdAtFormatted" },
        { Header: "Actions", accessor: "actions" },
    ];

    const formatData = (users) => {
        return users.map(user => ({
            ...user,
            createdAtFormatted: formatCreatedAtDisplay(user.createdAt),
            role: (
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                    {formatRoleLabel(user.role)}
                </span>
            ),
            status: (
                <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${user.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                        }`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                </div>
            ),
            actions: (
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => toggleUserStatus(user.id, user.isActive)}
                        className={`p-2 rounded-lg ${user.isActive
                            ? 'text-red-600 hover:bg-red-50'
                            : 'text-green-600 hover:bg-green-50'
                            }`}
                        title={user.isActive ? 'Deactivate User' : 'Activate User'}
                    >
                        {user.isActive ? <MdCancel className="h-4 w-4" /> : <MdCheckCircle className="h-4 w-4" />}
                    </button>
                    <button
                        onClick={() => {
                            setSelectedUser(user);
                            setShowModal(true);
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="View Details"
                    >
                        <MdEdit className="h-4 w-4" />
                    </button>
                </div>
            )
        }));
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
            <div className="mt-6 mb-6 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl font-bold text-navy-700 dark:text-white">
                    User Management
                </h2>
                <button
                    type="button"
                    onClick={() => fetchUsers()}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-navy-700 hover:bg-gray-50 dark:border-white/20 dark:bg-navy-800 dark:text-white dark:hover:bg-navy-700"
                >
                    Refresh list
                </button>
            </div>

            {fetchError ? (
                <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
                    <p className="font-semibold">Could not load users</p>
                    <p className="mt-2 whitespace-pre-wrap">{fetchError}</p>
                    {currentUser?.uid ? (
                        <p className="mt-2 text-xs opacity-90">
                            Your Auth UID (use as Firestore document ID for your profile):{" "}
                            <code className="rounded bg-white/70 px-1 dark:bg-black/40">{currentUser.uid}</code>
                        </p>
                    ) : null}
                    <button
                        type="button"
                        onClick={() => fetchUsers()}
                        className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                    >
                        Retry
                    </button>
                </div>
            ) : null}

            {!fetchError && users.length === 0 ? (
                <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                    No user documents in Firestore yet, or none are visible with your current account rules.
                </p>
            ) : null}

            <ComplexTable
                columnsData={userColumns}
                tableData={formatData(users)}
            />

            {/* User Details Modal */}
            {showModal && selectedUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="w-full max-w-md rounded-lg bg-white p-6 dark:bg-navy-800">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-xl font-bold text-navy-700 dark:text-white">
                                User Details
                            </h3>
                            <button
                                onClick={() => setShowModal(false)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <MdCancel className="h-6 w-6" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-gray-600">Name</label>
                                <p className="text-lg font-semibold text-navy-700 dark:text-white">
                                    {selectedUser.displayName || 'N/A'}
                                </p>
                            </div>

                            <div>
                                <label className="text-sm font-medium text-gray-600">Email</label>
                                <p className="text-navy-700 dark:text-white">{selectedUser.email || 'N/A'}</p>
                            </div>

                            <div>
                                <label className="text-sm font-medium text-gray-600">Role</label>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(selectedUser.role)}`}>
                                    {formatRoleLabel(selectedUser.role)}
                                </span>
                            </div>

                            <div>
                                <label className="text-sm font-medium text-gray-600">Hotel</label>
                                <p className="text-navy-700 dark:text-white">{selectedUser.hotelName || 'N/A'}</p>
                            </div>

                            <div>
                                <label className="text-sm font-medium text-gray-600">Phone</label>
                                <p className="text-navy-700 dark:text-white">{selectedUser.phoneNumber || 'N/A'}</p>
                            </div>

                            <div>
                                <label className="text-sm font-medium text-gray-600">Status</label>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${selectedUser.isActive
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                    }`}>
                                    {selectedUser.isActive ? 'Active' : 'Inactive'}
                                </span>
                            </div>

                            <div>
                                <label className="text-sm font-medium text-gray-600">Created At</label>
                                <p className="text-navy-700 dark:text-white">
                                    {formatCreatedAtDisplay(selectedUser.createdAt) || 'N/A'}
                                </p>
                            </div>
                        </div>

                        <div className="mt-6 flex gap-3">
                            <button
                                onClick={() => setShowModal(false)}
                                className="flex-1 rounded-lg bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300"
                            >
                                Close
                            </button>
                            <button
                                onClick={() => {
                                    toggleUserStatus(selectedUser.id, selectedUser.isActive);
                                    setShowModal(false);
                                }}
                                className={`flex-1 rounded-lg px-4 py-2 text-white ${selectedUser.isActive
                                    ? 'bg-red-500 hover:bg-red-600'
                                    : 'bg-green-500 hover:bg-green-600'
                                    }`}
                            >
                                {selectedUser.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManagement;
