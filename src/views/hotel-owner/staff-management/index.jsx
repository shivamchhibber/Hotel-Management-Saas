import React, { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc, query, where, limit } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../../../firebase/config";
import { useAuth } from "contexts/AuthContext";
import ComplexTable from "views/admin/default/components/ComplexTable";
import InputField from "components/fields/InputField";
import {
    MdAdd,
    MdCheckCircle,
    MdCancel,
    MdEmail,
    MdLock,
    MdVisibility,
    MdVisibilityOff,
    MdDelete,
    MdRefresh
} from "react-icons/md";

const StaffManagement = () => {
    const { currentUser } = useAuth();
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedStaff, setSelectedStaff] = useState(null);
    const [formData, setFormData] = useState({
        displayName: '',
        email: '',
        phoneNumber: '',
        password: '',
        role: 'hotel_staff'
    });
    const [showPassword, setShowPassword] = useState(false);
    const [generatedCredentials, setGeneratedCredentials] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
    const [staffToDelete, setStaffToDelete] = useState(null);
    const [resetPasswordCredentials, setResetPasswordCredentials] = useState(null);

    useEffect(() => {
        if (currentUser) {
            fetchStaff();
        }
    }, [currentUser]);

    const fetchStaff = async () => {
        try {
            setLoading(true);

            // Resolve current owner's users doc id (not auth uid)
            const ownerSnap = await getDocs(query(collection(db, "users"), where("uid", "==", currentUser.uid), limit(1)));
            const ownerDocId = ownerSnap.docs[0]?.id;

            // Find the hotel owned by this owner document id
            const hotelSnap = await getDocs(query(collection(db, "hotels"), where("ownerId", "==", ownerDocId), limit(1)));
            const hotelId = hotelSnap.docs[0]?.id;

            if (!hotelId) {
                console.error("No hotel ID found for user");
                return;
            }

            // Fetch staff for this hotel
            const staffQuery = query(
                collection(db, "users"),
                where("hotelId", "==", hotelId),
                where("role", "==", "hotel_staff")
            );
            const staffSnapshot = await getDocs(staffQuery);
            const staffData = staffSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            // Sort by creation date in JavaScript
            staffData.sort((a, b) => {
                const dateA = a.createdAt?.toDate() || new Date(0);
                const dateB = b.createdAt?.toDate() || new Date(0);
                return dateB - dateA; // Most recent first
            });
            
            console.log('Fetched staff data:', staffData);
            console.log('Hotel ID:', hotelId);
            setStaff(staffData);
        } catch (error) {
            console.error("Error fetching staff:", error);
        } finally {
            setLoading(false);
        }
    };

    const generatePassword = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let password = '';
        for (let i = 0; i < 12; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    };

    const handleAddStaff = async (e) => {
        e.preventDefault();
        try {
            // Generate password if not provided
            const password = formData.password || generatePassword();

            const createStaffUser = httpsCallable(functions, 'createStaffUser');

            await createStaffUser({
                email: formData.email,
                password: password,
                displayName: formData.displayName,
                phoneNumber: formData.phoneNumber || null,
            });

            // Show generated credentials
            setGeneratedCredentials({
                email: formData.email,
                password: password,
                displayName: formData.displayName
            });

            setShowAddModal(false);
            setFormData({ displayName: '', email: '', phoneNumber: '', password: '', role: 'hotel_staff' });
            fetchStaff();
            
        } catch (error) {
            console.error("Error adding staff:", error);
            alert("Error creating staff account: " + error.message);
        }
    };

    const toggleStaffStatus = async (staffId, currentStatus) => {
        try {
            const staffRef = doc(db, "users", staffId);
            await updateDoc(staffRef, {
                isActive: !currentStatus,
                updatedAt: new Date()
            });

            // Update local state
            setStaff(staff.map(member =>
                member.id === staffId
                    ? { ...member, isActive: !currentStatus }
                    : member
            ));
        } catch (error) {
            console.error("Error updating staff status:", error);
        }
    };

    const handleDeleteStaff = async () => {
        try {
            if (!staffToDelete) return;

            // Call the Firebase Function to delete staff user
            const deleteStaffUser = httpsCallable(functions, 'deleteStaffUser');
            
            await deleteStaffUser({
                staffUid: staffToDelete.id
            });

            // Remove from local state
            setStaff(staff.filter(member => member.id !== staffToDelete.id));
            
            setShowDeleteModal(false);
            setStaffToDelete(null);
            
            alert("Staff member deleted successfully!");
        } catch (error) {
            console.error("Error deleting staff:", error);
            alert("Error deleting staff member: " + error.message);
        }
    };

    const handleResetPassword = async () => {
        try {
            if (!staffToDelete) return;

            const resetStaffPassword = httpsCallable(functions, 'resetStaffPassword');

            const result = await resetStaffPassword({
                staffUid: staffToDelete.id,
            });

            setResetPasswordCredentials({
                message: result.data.message,
                emailSent: result.data.emailSent,
                staffEmail: result.data.staffEmail,
                staffName: result.data.staffName,
            });

            setShowResetPasswordModal(false);
            setStaffToDelete(null);

        } catch (error) {
            console.error("Error resetting password:", error);
            alert("Error resetting password: " + error.message);
        }
    };

    const confirmDeleteStaff = (staffMember) => {
        setStaffToDelete(staffMember);
        setShowDeleteModal(true);
    };

    const confirmResetPassword = (staffMember) => {
        setStaffToDelete(staffMember);
        setShowResetPasswordModal(true);
    };

    const staffColumns = [
        { Header: "Name", accessor: "displayName" },
        { Header: "Email", accessor: "email" },
        { Header: "Phone", accessor: "phoneNumber" },
        { Header: "Status", accessor: "status" },
        { Header: "Actions", accessor: "actions" },
    ];

    const formatData = (staff) => {
        return staff.map(member => ({
            ...member,
            status: (
                <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${member.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                        }`}>
                        {member.isActive ? 'Active' : 'Inactive'}
                    </span>
                </div>
            ),
            actions: (
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => toggleStaffStatus(member.id, member.isActive)}
                        className={`p-2 rounded-lg ${member.isActive
                            ? 'text-red-600 hover:bg-red-50'
                            : 'text-green-600 hover:bg-green-50'
                            }`}
                        title={member.isActive ? 'Deactivate Staff' : 'Activate Staff'}
                    >
                        {member.isActive ? <MdCancel className="h-4 w-4" /> : <MdCheckCircle className="h-4 w-4" />}
                    </button>
                    <button
                        onClick={() => confirmResetPassword(member)}
                        className="p-2 rounded-lg text-blue-600 hover:bg-blue-50"
                        title="Reset Password"
                    >
                        <MdRefresh className="h-4 w-4" />
                    </button>
                    <button
                        onClick={() => confirmDeleteStaff(member)}
                        className="p-2 rounded-lg text-red-600 hover:bg-red-50"
                        title="Delete Staff"
                    >
                        <MdDelete className="h-4 w-4" />
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
            <div className="mt-6 mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-navy-700 dark:text-white">
                    Staff Management
                </h2>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-white hover:bg-brand-600"
                >
                    <MdAdd className="h-4 w-4" />
                    Add Staff
                </button>
            </div>

            <ComplexTable
                columnsData={staffColumns}
                tableData={formatData(staff)}
            />

            {/* Add Staff Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="w-full max-w-md rounded-lg bg-white p-6 dark:bg-navy-800">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-xl font-bold text-navy-700 dark:text-white">
                                Add Staff Member
                            </h3>
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <MdCancel className="h-6 w-6" />
                            </button>
                        </div>

                        <form onSubmit={handleAddStaff} className="space-y-4">
                            <InputField
                                label="Full Name*"
                                placeholder="Enter full name"
                                value={formData.displayName}
                                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                                required
                            />

                            <InputField
                                label="Email*"
                                type="email"
                                placeholder="Enter email address"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                required
                            />

                            <InputField
                                label="Phone Number (optional)"
                                type="tel"
                                placeholder="Enter phone number"
                                value={formData.phoneNumber}
                                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                            />

                            <div>
                                <label className="block text-sm font-medium text-navy-700 dark:text-white mb-2">
                                    Password (Optional - will auto-generate if empty)
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Enter password or leave empty for auto-generation"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        className="w-full p-3 pr-10 border border-gray-200 rounded-xl dark:border-white/10 dark:bg-navy-800 dark:text-white"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                    >
                                        {showPassword ? <MdVisibilityOff className="h-5 w-5" /> : <MdVisibility className="h-5 w-5" />}
                                    </button>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="flex-1 rounded-lg bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 rounded-lg bg-brand-500 px-4 py-2 text-white hover:bg-brand-600"
                                >
                                    Create Staff Account
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Generated Credentials Modal */}
            {generatedCredentials && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="w-full max-w-md rounded-lg bg-white p-6 dark:bg-navy-800">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-xl font-bold text-navy-700 dark:text-white">
                                Staff Account Created Successfully!
                            </h3>
                            <button
                                onClick={() => setGeneratedCredentials(null)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <MdCancel className="h-6 w-6" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
                                <div className="flex items-center gap-2 mb-2">
                                    <MdCheckCircle className="h-5 w-5 text-green-600" />
                                    <span className="font-medium text-green-800 dark:text-green-200">
                                        Staff member "{generatedCredentials.displayName}" has been created successfully.
                                    </span>
                                </div>
                                <p className="text-sm text-green-700 dark:text-green-300">
                                    Please share these login credentials with the staff member:
                                </p>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-sm font-medium text-navy-700 dark:text-white mb-1">
                                        Email
                                    </label>
                                    <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-navy-700 rounded-lg">
                                        <MdEmail className="h-4 w-4 text-gray-500" />
                                        <span className="font-mono text-sm">{generatedCredentials.email}</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-navy-700 dark:text-white mb-1">
                                        Password
                                    </label>
                                    <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-navy-700 rounded-lg">
                                        <MdLock className="h-4 w-4 text-gray-500" />
                                        <span className="font-mono text-sm">{generatedCredentials.password}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-lg bg-yellow-50 p-4 dark:bg-yellow-900/20">
                                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                    <strong>Important:</strong> Please save these credentials securely. The staff member will need these to log in to their account.
                                </p>
                            </div>

                            <button
                                onClick={() => setGeneratedCredentials(null)}
                                className="w-full rounded-lg bg-brand-500 px-4 py-2 text-white hover:bg-brand-600"
                            >
                                Got it!
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && staffToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="w-full max-w-md rounded-lg bg-white p-6 dark:bg-navy-800">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-xl font-bold text-red-600 dark:text-red-400">
                                Delete Staff Member
                            </h3>
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <MdCancel className="h-6 w-6" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
                                <p className="text-red-800 dark:text-red-200">
                                    <strong>Warning:</strong> This action cannot be undone. The staff member will be permanently deleted and will lose access to their account.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <p className="text-navy-700 dark:text-white">
                                    Are you sure you want to delete <strong>{staffToDelete.displayName}</strong>?
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Email: {staffToDelete.email}
                                </p>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowDeleteModal(false)}
                                    className="flex-1 rounded-lg bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeleteStaff}
                                    className="flex-1 rounded-lg bg-red-500 px-4 py-2 text-white hover:bg-red-600"
                                >
                                    Delete Staff
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Reset Password Confirmation Modal */}
            {showResetPasswordModal && staffToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="w-full max-w-md rounded-lg bg-white p-6 dark:bg-navy-800">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-xl font-bold text-blue-600 dark:text-blue-400">
                                Reset Password
                            </h3>
                            <button
                                onClick={() => setShowResetPasswordModal(false)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <MdCancel className="h-6 w-6" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
                                <p className="text-blue-800 dark:text-blue-200">
                                    Sends a Firebase password reset link to <strong>{staffToDelete.displayName}</strong> when SMTP is configured on Cloud Functions. Otherwise the link is not emailed (see server logs / README).
                                </p>
                            </div>

                            <div className="space-y-2">
                                <p className="text-navy-700 dark:text-white">
                                    Staff Member: <strong>{staffToDelete.displayName}</strong>
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Email: {staffToDelete.email}
                                </p>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowResetPasswordModal(false)}
                                    className="flex-1 rounded-lg bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleResetPassword}
                                    className="flex-1 rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
                                >
                                    Reset Password
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Reset Password Credentials Modal */}
            {resetPasswordCredentials && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="w-full max-w-md rounded-lg bg-white p-6 dark:bg-navy-800">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-xl font-bold text-navy-700 dark:text-white">
                                Password reset
                            </h3>
                            <button
                                onClick={() => setResetPasswordCredentials(null)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <MdCancel className="h-6 w-6" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className={`rounded-lg p-4 ${resetPasswordCredentials.emailSent ? 'bg-green-50 dark:bg-green-900/20' : 'bg-amber-50 dark:bg-amber-900/20'}`}>
                                <div className="flex items-center gap-2 mb-2">
                                    <MdCheckCircle className="h-5 w-5 text-green-600" />
                                    <span className="font-medium text-navy-800 dark:text-white">
                                        {resetPasswordCredentials.message}
                                    </span>
                                </div>
                                <p className="text-sm text-navy-700 dark:text-gray-300">
                                    {resetPasswordCredentials.staffName ? `Staff: ${resetPasswordCredentials.staffName}` : ''}
                                    {resetPasswordCredentials.staffEmail ? ` · ${resetPasswordCredentials.staffEmail}` : ''}
                                </p>
                            </div>

                            {!resetPasswordCredentials.emailSent && (
                                <div className="rounded-lg bg-yellow-50 p-4 dark:bg-yellow-900/20">
                                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                        Configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and optional SMTP_FROM on your Firebase Function to email reset links automatically.
                                    </p>
                                </div>
                            )}

                            <button
                                onClick={() => setResetPasswordCredentials(null)}
                                className="w-full rounded-lg bg-brand-500 px-4 py-2 text-white hover:bg-brand-600"
                            >
                                Got it
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StaffManagement;
