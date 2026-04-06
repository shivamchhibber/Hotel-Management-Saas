import React, { useState, useEffect, useCallback } from "react";
import { getDoc, doc } from "firebase/firestore";
import { db } from "../../../firebase/config";
import { useAuth } from "../../../contexts/AuthContext";
import { getHotelIdFromUserProfile } from "utils/userProfileUtils";
import { staffListMyStaffActionsFn } from "utils/staffCallables";
import {
    MdPerson,
    MdEmail,
    MdPhone,
    MdHotel,
    MdHistory,
    MdCheckCircle,
    MdCancel,
    MdEdit,
    MdRoom
} from "react-icons/md";

const StaffProfile = () => {
    const { currentUser } = useAuth();
    const [staffInfo, setStaffInfo] = useState(null);
    const [actionHistory, setActionHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [hotelInfo, setHotelInfo] = useState(null);

    const fetchStaffInfo = useCallback(async () => {
        try {
            if (currentUser?.uid) {
                const hotelIdStr = (await getHotelIdFromUserProfile(currentUser.uid)) || "";

                setStaffInfo({
                    displayName: currentUser.displayName || "Staff Member",
                    email: currentUser.email || "",
                    phoneNumber: currentUser.phoneNumber || "",
                    role: "Hotel Staff",
                    hotelId: hotelIdStr,
                });

                if (hotelIdStr) {
                    const hotelDoc = await getDoc(doc(db, "hotels", hotelIdStr));
                    if (hotelDoc.exists()) {
                        const hotelData = hotelDoc.data();
                        setHotelInfo({
                            name: hotelData.name || 'Unknown Hotel',
                            address: hotelData.address || '',
                            phone: hotelData.phone || ''
                        });
                    }
                }
            }
        } catch (error) {
            console.error("Error fetching staff info:", error);
        }
    }, [currentUser]);

    const fetchActionHistory = useCallback(async () => {
        try {
            if (!currentUser?.uid) {
                setLoading(false);
                return;
            }
            let actionsData = [];
            try {
                const { data } = await staffListMyStaffActionsFn({});
                actionsData = Array.isArray(data?.actions) ? data.actions : [];
            } catch (callableErr) {
                console.warn("staffListMyStaffActions failed:", callableErr);
            }
            setActionHistory(actionsData.slice(0, 20));
        } catch (error) {
            console.error("Error fetching action history:", error);
        } finally {
            setLoading(false);
        }
    }, [currentUser]);

    useEffect(() => {
        if (currentUser) {
            fetchStaffInfo();
            fetchActionHistory();
        }
    }, [currentUser, fetchStaffInfo, fetchActionHistory]);

    const formatTimestamp = (timestamp) => {
        if (timestamp == null || timestamp === "") return "Unknown";
        if (typeof timestamp === "number") {
            return new Date(timestamp).toLocaleString();
        }
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleString();
    };

    const getActionIcon = (actionType) => {
        switch (actionType) {
            case 'room_status_change':
                return <MdRoom className="h-4 w-4 text-blue-500" />;
            case 'guest_checkin':
                return <MdCheckCircle className="h-4 w-4 text-green-500" />;
            case 'guest_checkout':
                return <MdCancel className="h-4 w-4 text-red-500" />;
            case 'room_maintenance':
                return <MdEdit className="h-4 w-4 text-yellow-500" />;
            default:
                return <MdHistory className="h-4 w-4 text-gray-500" />;
        }
    };

    const getActionColor = (actionType) => {
        switch (actionType) {
            case 'room_status_change':
                return 'bg-blue-50 text-blue-800';
            case 'guest_checkin':
                return 'bg-green-50 text-green-800';
            case 'guest_checkout':
                return 'bg-red-50 text-red-800';
            case 'room_maintenance':
                return 'bg-yellow-50 text-yellow-800';
            default:
                return 'bg-gray-50 text-gray-800';
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
        <div className="space-y-6">
            {/* Profile Header */}
            <div className="bg-white dark:bg-navy-800 rounded-lg shadow-sm p-6">
                <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-brand-500 rounded-full flex items-center justify-center">
                        <MdPerson className="h-8 w-8 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-navy-700 dark:text-white">
                            {staffInfo?.displayName || 'Staff Member'}
                        </h1>
                        <p className="text-gray-600 dark:text-gray-300">Hotel Staff</p>
                        {hotelInfo && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {hotelInfo.name}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Profile Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Personal Information */}
                <div className="bg-white dark:bg-navy-800 rounded-lg shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-navy-700 dark:text-white mb-4">
                        Personal Information
                    </h2>
                    <div className="space-y-3">
                        <div className="flex items-center space-x-3">
                            <MdEmail className="h-5 w-5 text-gray-400" />
                            <div>
                                <p className="text-sm text-gray-500">Email</p>
                                <p className="text-navy-700 dark:text-white">{staffInfo?.email || 'Not provided'}</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-3">
                            <MdPhone className="h-5 w-5 text-gray-400" />
                            <div>
                                <p className="text-sm text-gray-500">Phone</p>
                                <p className="text-navy-700 dark:text-white">{staffInfo?.phoneNumber || 'Not provided'}</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-3">
                            <MdHotel className="h-5 w-5 text-gray-400" />
                            <div>
                                <p className="text-sm text-gray-500">Hotel</p>
                                <p className="text-navy-700 dark:text-white">{hotelInfo?.name || 'Unknown Hotel'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Hotel Information */}
                {hotelInfo && (
                    <div className="bg-white dark:bg-navy-800 rounded-lg shadow-sm p-6">
                        <h2 className="text-lg font-semibold text-navy-700 dark:text-white mb-4">
                            Hotel Information
                        </h2>
                        <div className="space-y-3">
                            <div>
                                <p className="text-sm text-gray-500">Hotel Name</p>
                                <p className="text-navy-700 dark:text-white">{hotelInfo.name}</p>
                            </div>
                            {hotelInfo.address && (
                                <div>
                                    <p className="text-sm text-gray-500">Address</p>
                                    <p className="text-navy-700 dark:text-white">{hotelInfo.address}</p>
                                </div>
                            )}
                            {hotelInfo.phone && (
                                <div>
                                    <p className="text-sm text-gray-500">Phone</p>
                                    <p className="text-navy-700 dark:text-white">{hotelInfo.phone}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Action History */}
            <div className="bg-white dark:bg-navy-800 rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-navy-700 dark:text-white mb-4">
                    Recent Actions
                </h2>
                {actionHistory.length === 0 ? (
                    <div className="text-center py-8">
                        <MdHistory className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500 dark:text-gray-400">No actions recorded yet</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {actionHistory.map((action) => (
                            <div key={action.id} className="flex items-center space-x-4 p-3 bg-gray-50 dark:bg-navy-700 rounded-lg">
                                <div className="flex-shrink-0">
                                    {getActionIcon(action.actionType)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-navy-700 dark:text-white">
                                        {action.description || 'Action performed'}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {formatTimestamp(action.timestamp)}
                                    </p>
                                </div>
                                <div className="flex-shrink-0">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getActionColor(action.actionType)}`}>
                                        {action.actionType?.replace(/_/g, ' ').toUpperCase() || 'ACTION'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default StaffProfile;
