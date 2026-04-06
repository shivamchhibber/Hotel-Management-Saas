import React, { useState, useEffect, useCallback } from "react";
import { collection, getDocs, doc, updateDoc, addDoc, query, where, serverTimestamp } from "firebase/firestore";
import { db } from "../../../firebase/config";
import { useAuth } from "contexts/AuthContext";
import { getHotelIdFromUserProfile } from "utils/userProfileUtils";
import { formatCallableError } from "utils/callableError";
import { staffListRoomsFn, staffUpdateRoomFn } from "utils/staffCallables";
import GuestIdCaptureBlock from "components/guest/GuestIdCaptureBlock";
import Modal from "components/ui/Modal";
import BottomSheet from "components/ui/BottomSheet";
import ComplexTable from "views/admin/default/components/ComplexTable";
import {
    MdBuild,
    MdPerson,
    MdEventAvailable,
    MdEventBusy,
    MdCheckCircle,
    MdRefresh,
    MdLogin,
    MdExitToApp,
    MdClose
} from "react-icons/md";

const StaffRoomManagement = () => {
    const { currentUser } = useAuth();
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [showCheckInModal, setShowCheckInModal] = useState(false);
    const [showGuestDetailsModal, setShowGuestDetailsModal] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [showCheckoutModal, setShowCheckoutModal] = useState(false);
    const [checkoutRoom, setCheckoutRoom] = useState(null);
    const [checkoutExtraCharges, setCheckoutExtraCharges] = useState("0");
    const [checkoutReason, setCheckoutReason] = useState("damages");
    const [checkInHotelId, setCheckInHotelId] = useState(null);
    const [guestForm, setGuestForm] = useState({
        guestName: '',
        guestEmail: '',
        guestPhone: '',
        idDocumentType: 'aadhaar',
        idDocumentNumber: '',
        idImages: [],
        checkInDate: '',
        checkOutDate: '',
        numberOfGuests: 1,
        specialRequests: ''
    });

    const fetchRooms = useCallback(async () => {
        try {
            setLoading(true);

            let roomsData = [];
            try {
                const { data } = await staffListRoomsFn({});
                roomsData = Array.isArray(data?.rooms) ? data.rooms : [];
            } catch (callableErr) {
                console.warn("staffListRooms callable failed; falling back to Firestore query:", callableErr);
                const hotelId = await getHotelIdFromUserProfile(currentUser.uid);
                if (!hotelId) {
                    console.error(
                        "No hotel ID on users/{uid}; staff must be created via owner → Add staff (callable), not only Auth console.",
                    );
                    setRooms([]);
                    return;
                }
                const roomsQuery = query(collection(db, "rooms"), where("hotelId", "==", hotelId));
                const roomsSnapshot = await getDocs(roomsQuery);
                roomsData = roomsSnapshot.docs.map((d) => ({
                    id: d.id,
                    ...d.data(),
                }));
                roomsData.sort((a, b) => {
                    const roomA = parseInt(a.roomNumber, 10) || 0;
                    const roomB = parseInt(b.roomNumber, 10) || 0;
                    return roomA - roomB;
                });
            }
            setRooms(roomsData);
        } catch (error) {
            console.error("Error fetching rooms:", error);
            const msg = String(error?.code || error?.message || "");
            if (msg.includes("permission") || msg.includes("permissions")) {
                console.error(
                    "Firestore denied the rooms query. Deploy functions (staffListRooms) + grant invoker, deploy firestore.rules, and ensure users/{uid}.hotelId matches room.hotelId.",
                );
            }
            if (msg.includes("functions/") || msg.includes("internal")) {
                console.error(formatCallableError(error, "staffListRooms"));
            }
        } finally {
            setLoading(false);
        }
    }, [currentUser]);

    useEffect(() => {
        if (currentUser) {
            fetchRooms();
        }
    }, [currentUser, fetchRooms]);

    useEffect(() => {
        let cancelled = false;
        if (!showCheckInModal || !currentUser?.uid) {
            setCheckInHotelId(null);
            return undefined;
        }
        (async () => {
            const hid = await getHotelIdFromUserProfile(currentUser.uid);
            if (!cancelled) setCheckInHotelId(hid);
        })();
        return () => {
            cancelled = true;
        };
    }, [showCheckInModal, currentUser]);

    const updateRoomStatus = async (roomId, newStatus, guestInfo = null, billing = null) => {
        try {
            setUpdating(true);
            try {
                const { data } = await staffUpdateRoomFn({
                    roomId,
                    status: newStatus,
                    guestInfo: guestInfo || null,
                    additionalCharges: billing?.additionalCharges ?? null,
                    additionalChargeReason: billing?.additionalChargeReason ?? null,
                    amount: billing?.amount ?? null,
                });
                if (data?.room) {
                    setRooms((prev) =>
                        prev.map((room) => (room.id === roomId ? { ...data.room } : room)),
                    );
                    return;
                }
            } catch (callableErr) {
                console.warn("staffUpdateRoom failed; falling back to Firestore:", callableErr);
            }

            const roomRef = doc(db, "rooms", roomId);
            const updateData = {
                status: newStatus,
                updatedAt: serverTimestamp(),
                updatedBy: currentUser.uid,
            };

            if (newStatus === "checked-in" && guestInfo) {
                updateData.guestInfo = guestInfo;
                updateData.checkInDate = serverTimestamp();
            }

            if (newStatus === "checked-out") {
                updateData.guestInfo = null;
                updateData.checkOutDate = serverTimestamp();
            }

            await updateDoc(roomRef, updateData);
            await logStaffAction(roomId, newStatus, guestInfo);

            setRooms((prev) =>
                prev.map((room) => {
                    if (room.id !== roomId) return room;
                    return {
                        ...room,
                        status: newStatus,
                        ...(newStatus === "checked-out" ? { guestInfo: null } : {}),
                        ...(newStatus === "checked-in" && guestInfo ? { guestInfo } : {}),
                    };
                }),
            );
        } catch (error) {
            console.error("Error updating room status:", error);
            alert("Error updating room status: " + error.message);
        } finally {
            setUpdating(false);
        }
    };

    const openCheckoutModal = (room) => {
        setCheckoutRoom(room);
        setCheckoutExtraCharges("0");
        setCheckoutReason("damages");
        setShowCheckoutModal(true);
    };

    const confirmCheckout = async () => {
        if (!checkoutRoom) return;
        const extra = Number(checkoutExtraCharges || 0);
        await updateRoomStatus(checkoutRoom.id, "checked-out", null, {
            additionalCharges: Number.isFinite(extra) ? extra : 0,
            additionalChargeReason: checkoutReason,
        });
        setShowCheckoutModal(false);
        setCheckoutRoom(null);
    };

    const logStaffAction = async (roomId, action, guestInfo = null) => {
        try {
            const room = rooms.find(r => r.id === roomId);
            const actionData = {
                staffId: currentUser.uid,
                hotelId: room?.hotelId,
                roomId: roomId,
                roomNumber: room?.roomNumber,
                actionType: action === 'checked-in' ? 'guest_checkin' : 
                           action === 'checked-out' ? 'guest_checkout' : 'room_status_change',
                description: action === 'checked-in' ? 
                    `Checked in guest ${guestInfo?.guestName} to Room ${room?.roomNumber}` :
                    action === 'checked-out' ?
                    `Checked out guest from Room ${room?.roomNumber}` :
                    `Changed Room ${room?.roomNumber} status to ${action}`,
                timestamp: serverTimestamp(),
                guestInfo: guestInfo || null
            };

            await addDoc(collection(db, "staff_actions"), actionData);
        } catch (error) {
            console.error("Error logging staff action:", error);
        }
    };

    const handleCheckIn = (room) => {
        setSelectedRoom(room);
        setGuestForm({
            guestName: '',
            guestEmail: '',
            guestPhone: '',
            idDocumentType: 'aadhaar',
            idDocumentNumber: '',
            idImages: [],
            checkInDate: new Date().toISOString().split('T')[0],
            checkOutDate: '',
            numberOfGuests: 1,
            specialRequests: ''
        });
        setShowCheckInModal(true);
    };

    const handleShowGuestDetails = (room) => {
        setSelectedRoom(room);
        setShowGuestDetailsModal(true);
    };

    const handleCheckInSubmit = async (e) => {
        e.preventDefault();
        if (!selectedRoom) return;

        try {
            const guestInfo = {
                guestName: guestForm.guestName,
                guestEmail: guestForm.guestEmail,
                guestPhone: guestForm.guestPhone,
                guestId: guestForm.idDocumentNumber,
                idDocumentType: guestForm.idDocumentType,
                idDocumentNumber: guestForm.idDocumentNumber,
                idDocumentImages: guestForm.idImages.map(({ url, type, fromProfile }) => ({
                    url,
                    type: type || guestForm.idDocumentType,
                    fromProfile: !!fromProfile,
                })),
                checkInDate: new Date(guestForm.checkInDate),
                checkOutDate: guestForm.checkOutDate ? new Date(guestForm.checkOutDate) : null,
                numberOfGuests: guestForm.numberOfGuests,
                specialRequests: guestForm.specialRequests,
                checkedInBy: currentUser.uid,
                checkedInAt: new Date()
            };

            await updateRoomStatus(selectedRoom.id, 'checked-in', guestInfo);
            setShowCheckInModal(false);
            setSelectedRoom(null);
        } catch (error) {
            console.error("Error during check-in:", error);
            alert("Error during check-in: " + error.message);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'available': return 'bg-green-100 text-green-800';
            case 'occupied': return 'bg-red-100 text-red-800';
            case 'maintenance': return 'bg-yellow-100 text-yellow-800';
            case 'checked-in': return 'bg-blue-100 text-blue-800';
            case 'checked-out': return 'bg-gray-100 text-gray-800';
            case 'booked': return 'bg-purple-100 text-purple-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'available': return <MdEventAvailable className="h-4 w-4" />;
            case 'occupied': return <MdPerson className="h-4 w-4" />;
            case 'maintenance': return <MdBuild className="h-4 w-4" />;
            case 'checked-in': return <MdCheckCircle className="h-4 w-4" />;
            case 'checked-out': return <MdEventBusy className="h-4 w-4" />;
            case 'booked': return <MdLogin className="h-4 w-4" />;
            default: return <MdEventAvailable className="h-4 w-4" />;
        }
    };

    const getAvailableActions = (room) => {
        const actions = [];
        
        switch (room.status) {
            case 'available':
                actions.push(
                    <button
                        key="checkin"
                        onClick={() => handleCheckIn(room)}
                        className="px-3 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                        title="Check-in Guest"
                    >
                        <MdLogin className="h-3 w-3 inline mr-1" />
                        Check-in
                    </button>
                );
                actions.push(
                    <button
                        key="maintenance"
                        onClick={() => updateRoomStatus(room.id, 'maintenance')}
                        disabled={updating}
                        className="px-3 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-700 hover:bg-yellow-200 transition-colors"
                        title="Set to Maintenance"
                    >
                        <MdBuild className="h-3 w-3 inline mr-1" />
                        Maintenance
                    </button>
                );
                break;
            case 'checked-in':
                actions.push(
                    <button
                        key="checkout"
                        onClick={() => openCheckoutModal(room)}
                        disabled={updating}
                        className="px-3 py-1 rounded text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                        title="Check-out Guest"
                    >
                        <MdExitToApp className="h-3 w-3 inline mr-1" />
                        Check-out
                    </button>
                );
                actions.push(
                    <button
                        key="occupied"
                        onClick={() => updateRoomStatus(room.id, 'occupied')}
                        disabled={updating}
                        className="px-3 py-1 rounded text-xs font-medium bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors"
                        title="Set to Occupied"
                    >
                        <MdPerson className="h-3 w-3 inline mr-1" />
                        Occupied
                    </button>
                );
                break;
            case 'occupied':
                actions.push(
                    <button
                        key="available"
                        onClick={() => updateRoomStatus(room.id, 'available')}
                        disabled={updating}
                        className="px-3 py-1 rounded text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                        title="Set to Available"
                    >
                        <MdEventAvailable className="h-3 w-3 inline mr-1" />
                        Available
                    </button>
                );
                actions.push(
                    <button
                        key="checkout"
                        onClick={() => openCheckoutModal(room)}
                        disabled={updating}
                        className="px-3 py-1 rounded text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                        title="Check-out Guest"
                    >
                        <MdExitToApp className="h-3 w-3 inline mr-1" />
                        Check-out
                    </button>
                );
                break;
            case 'maintenance':
                actions.push(
                    <button
                        key="available"
                        onClick={() => updateRoomStatus(room.id, 'available')}
                        disabled={updating}
                        className="px-3 py-1 rounded text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                        title="Set to Available"
                    >
                        <MdEventAvailable className="h-3 w-3 inline mr-1" />
                        Available
                    </button>
                );
                break;
            case 'checked-out':
                actions.push(
                    <button
                        key="available"
                        onClick={() => updateRoomStatus(room.id, 'available')}
                        disabled={updating}
                        className="px-3 py-1 rounded text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                        title="Set to Available"
                    >
                        <MdEventAvailable className="h-3 w-3 inline mr-1" />
                        Available
                    </button>
                );
                actions.push(
                    <button
                        key="maintenance"
                        onClick={() => updateRoomStatus(room.id, 'maintenance')}
                        disabled={updating}
                        className="px-3 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-700 hover:bg-yellow-200 transition-colors"
                        title="Set to Maintenance"
                    >
                        <MdBuild className="h-3 w-3 inline mr-1" />
                        Maintenance
                    </button>
                );
                break;
            default:
                break;
        }

        return actions;
    };

    const roomColumns = [
        { Header: "Room #", accessor: "roomNumber" },
        { Header: "Type", accessor: "roomType" },
        { Header: "Floor", accessor: "floor" },
        { Header: "Price", accessor: "price" },
        { Header: "Current Status", accessor: "status" },
        { Header: "Guest Info", accessor: "guestInfo" },
        { Header: "Actions", accessor: "actions" },
    ];

    const formatData = (rooms) => {
        return rooms.map(room => ({
            ...room,
            price: `₹${room.price}/night`,
            status: (
                <div className="flex items-center gap-2">
                    {getStatusIcon(room.status)}
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(room.status)}`}>
                        {room.status.charAt(0).toUpperCase() + room.status.slice(1).replace('-', ' ')}
                    </span>
                </div>
            ),
            guestInfo: room.guestInfo ? (
                <div 
                    className="text-xs cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors"
                    onClick={() => handleShowGuestDetails(room)}
                    title="Click to view full guest details"
                >
                    <div className="font-medium text-navy-700 dark:text-white">
                        {room.guestInfo.guestName}
                    </div>
                    <div className="text-gray-500">
                        {room.guestInfo.guestPhone}
                    </div>
                    <div className="text-gray-500">
                        {room.guestInfo.numberOfGuests} guest{room.guestInfo.numberOfGuests > 1 ? 's' : ''}
                    </div>
                    {room.guestInfo.specialRequests && (
                        <div className="text-blue-600 mt-1">
                            <span className="font-medium">Requests:</span> {room.guestInfo.specialRequests.length > 30 ? 
                                room.guestInfo.specialRequests.substring(0, 30) + '...' : 
                                room.guestInfo.specialRequests}
                        </div>
                    )}
                    <div className="text-xs text-gray-400 mt-1">
                        Click for details
                    </div>
                </div>
            ) : (
                <span className="text-gray-400 text-xs">No guest</span>
            ),
            actions: (
                <div className="flex flex-wrap gap-1">
                    {getAvailableActions(room)}
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
                    Room Management
                </h2>
                <button
                    onClick={fetchRooms}
                    disabled={loading}
                    className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-white hover:bg-brand-600 disabled:opacity-50"
                >
                    <MdRefresh className="h-4 w-4" />
                    Refresh
                </button>
            </div>

            {/* Room Status Summary */}
            <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-6">
                {['available', 'occupied', 'maintenance', 'checked-in', 'checked-out', 'booked'].map(status => {
                    const count = rooms.filter(room => room.status === status).length;
                    return (
                        <div key={status} className="bg-white dark:bg-navy-800 p-4 rounded-lg shadow">
                            <div className="flex items-center gap-2">
                                {getStatusIcon(status)}
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                                    {status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')}
                                </span>
                            </div>
                            <div className="text-2xl font-bold text-navy-700 dark:text-white mt-1">
                                {count}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Instructions */}
            <div className="mb-6 rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
                <h3 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
                    Instructions:
                </h3>
                <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                    <li>• <strong>Check-in:</strong> Click "Check-in" on available rooms to register guest details</li>
                    <li>• <strong>Check-out:</strong> Click "Check-out" to complete guest stay</li>
                    <li>• <strong>Maintenance:</strong> Set rooms to maintenance when cleaning or repairs needed</li>
                    <li>• <strong>Available:</strong> Set rooms as available for new bookings</li>
                    <li>• <strong>Occupied:</strong> Mark rooms as occupied when guests are present</li>
                </ul>
            </div>

            {/* Mobile-first room grid (easier than tables) */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
                {rooms.map((room) => {
                    const status = room.status || "available";
                    const isCheckedIn = status === "checked-in" || status === "occupied";
                    const primary =
                        status === "available"
                            ? { label: "Check-in", onClick: () => handleCheckIn(room), className: "bg-brand-500 hover:bg-brand-600" }
                            : status === "checked-in" || status === "occupied"
                                ? { label: "Check-out", onClick: () => openCheckoutModal(room), className: "bg-red-500 hover:bg-red-600" }
                                : { label: "Mark available", onClick: () => updateRoomStatus(room.id, "available"), className: "bg-green-500 hover:bg-green-600" };
                    const secondary =
                        status === "available"
                            ? { label: "Maintenance", onClick: () => updateRoomStatus(room.id, "maintenance"), className: "bg-yellow-500 hover:bg-yellow-600" }
                            : status === "checked-in"
                                ? { label: "Occupied", onClick: () => updateRoomStatus(room.id, "occupied"), className: "bg-orange-500 hover:bg-orange-600" }
                                : null;

                    return (
                        <div key={room.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 dark:bg-navy-800 dark:ring-white/10">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Room</p>
                                    <p className="text-2xl font-semibold text-navy-700 dark:text-white">{room.roomNumber || "—"}</p>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(status)}`}>
                                    {status.replace("-", " ")}
                                </span>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Type</p>
                                    <p className="font-medium text-navy-700 dark:text-white">{room.roomType || "—"}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Price</p>
                                    <p className="font-medium text-navy-700 dark:text-white">₹{room.price || 0}</p>
                                </div>
                            </div>

                            {isCheckedIn && room.guestInfo?.guestName ? (
                                <button
                                    type="button"
                                    onClick={() => handleShowGuestDetails(room)}
                                    className="mt-3 w-full rounded-xl bg-gray-50 px-3 py-2 text-left text-sm text-navy-700 hover:bg-gray-100 dark:bg-navy-900 dark:text-white dark:hover:bg-navy-700"
                                >
                                    Guest: <span className="font-semibold">{room.guestInfo.guestName}</span>
                                </button>
                            ) : null}

                            <div className="mt-4 grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    disabled={updating}
                                    onClick={primary.onClick}
                                    className={`h-12 rounded-2xl text-base font-semibold text-white disabled:opacity-50 ${primary.className}`}
                                >
                                    {primary.label}
                                </button>
                                {secondary ? (
                                    <button
                                        type="button"
                                        disabled={updating}
                                        onClick={secondary.onClick}
                                        className={`h-12 rounded-2xl text-base font-semibold text-white disabled:opacity-50 ${secondary.className}`}
                                    >
                                        {secondary.label}
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        disabled
                                        className="h-12 rounded-2xl bg-gray-200 text-base font-semibold text-gray-500 opacity-60 dark:bg-navy-900 dark:text-gray-400"
                                    >
                                        —
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block">
                <ComplexTable
                    columnsData={roomColumns}
                    tableData={formatData(rooms)}
                />
            </div>

            {/* Check-in Modal */}
            <Modal
                open={showCheckInModal && !!selectedRoom}
                title={selectedRoom ? `Check-in · Room ${selectedRoom.roomNumber}` : "Check-in"}
                onClose={() => setShowCheckInModal(false)}
                maxWidthClass="max-w-md"
            >
                <form onSubmit={handleCheckInSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Guest Name *
                        </label>
                        <input
                            type="text"
                            required
                            value={guestForm.guestName}
                            onChange={(e) => setGuestForm({ ...guestForm, guestName: e.target.value })}
                            className="al-input"
                            placeholder="Enter guest full name"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Guest Email
                        </label>
                        <input
                            type="email"
                            value={guestForm.guestEmail}
                            onChange={(e) => setGuestForm({ ...guestForm, guestEmail: e.target.value })}
                            className="al-input"
                            placeholder="guest@example.com"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Guest Phone *
                        </label>
                        <input
                            type="tel"
                            required
                            value={guestForm.guestPhone}
                            onChange={(e) => setGuestForm({ ...guestForm, guestPhone: e.target.value })}
                            className="al-input"
                            placeholder="+91 9876543210"
                        />
                    </div>

                    <GuestIdCaptureBlock
                        staffUid={currentUser?.uid}
                        hotelId={checkInHotelId}
                        email={guestForm.guestEmail}
                        phone={guestForm.guestPhone}
                        idDocumentType={guestForm.idDocumentType}
                        setIdDocumentType={(v) => setGuestForm((f) => ({ ...f, idDocumentType: v }))}
                        idDocumentNumber={guestForm.idDocumentNumber}
                        setIdDocumentNumber={(v) => setGuestForm((f) => ({ ...f, idDocumentNumber: v }))}
                        idImages={guestForm.idImages}
                        setIdImages={(updater) =>
                            setGuestForm((f) => ({
                                ...f,
                                idImages: typeof updater === "function" ? updater(f.idImages) : updater,
                            }))
                        }
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Check-in Date *
                            </label>
                            <input
                                type="date"
                                required
                                value={guestForm.checkInDate}
                                onChange={(e) => setGuestForm({ ...guestForm, checkInDate: e.target.value })}
                                className="al-input"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Check-out Date
                            </label>
                            <input
                                type="date"
                                value={guestForm.checkOutDate}
                                onChange={(e) => setGuestForm({ ...guestForm, checkOutDate: e.target.value })}
                                className="al-input"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Number of Guests *
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="10"
                            required
                            value={guestForm.numberOfGuests}
                            onChange={(e) =>
                                setGuestForm({ ...guestForm, numberOfGuests: parseInt(e.target.value) })
                            }
                            className="al-input"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Special Requests
                        </label>
                        <textarea
                            value={guestForm.specialRequests}
                            onChange={(e) => setGuestForm({ ...guestForm, specialRequests: e.target.value })}
                            rows="3"
                            className="al-input"
                            placeholder="Any special requests or notes..."
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={() => setShowCheckInModal(false)}
                            className="flex-1 al-btn-secondary"
                        >
                            Cancel
                        </button>
                        <button type="submit" disabled={updating} className="flex-1 al-btn-primary">
                            {updating ? "Processing..." : "Check-in Guest"}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Guest Details Modal */}
            {showGuestDetailsModal && selectedRoom && selectedRoom.guestInfo && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-4">
                    <div className="min-h-full flex items-start justify-center py-6">
                        <div className="bg-white dark:bg-navy-800 p-6 rounded-2xl shadow-lg w-full max-w-md max-h-[85vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-navy-700 dark:text-white">
                                Guest Details - Room {selectedRoom.roomNumber}
                            </h3>
                            <button
                                onClick={() => setShowGuestDetailsModal(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <MdClose className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Guest Name
                                </label>
                                <p className="text-navy-700 dark:text-white">{selectedRoom.guestInfo.guestName}</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Email
                                </label>
                                <p className="text-navy-700 dark:text-white">{selectedRoom.guestInfo.guestEmail || 'Not provided'}</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Phone
                                </label>
                                <p className="text-navy-700 dark:text-white">{selectedRoom.guestInfo.guestPhone}</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    ID Number
                                </label>
                                <p className="text-navy-700 dark:text-white">{selectedRoom.guestInfo.guestId || 'Not provided'}</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Number of Guests
                                </label>
                                <p className="text-navy-700 dark:text-white">{selectedRoom.guestInfo.numberOfGuests}</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Check-in Date
                                </label>
                                <p className="text-navy-700 dark:text-white">
                                    {selectedRoom.guestInfo.checkInDate ? 
                                        (selectedRoom.guestInfo.checkInDate.toDate ? 
                                            selectedRoom.guestInfo.checkInDate.toDate().toLocaleDateString() :
                                            new Date(selectedRoom.guestInfo.checkInDate).toLocaleDateString()) : 
                                        'Not specified'}
                                </p>
                            </div>

                            {selectedRoom.guestInfo.checkOutDate && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Check-out Date
                                    </label>
                                    <p className="text-navy-700 dark:text-white">
                                        {selectedRoom.guestInfo.checkOutDate.toDate ? 
                                            selectedRoom.guestInfo.checkOutDate.toDate().toLocaleDateString() :
                                            new Date(selectedRoom.guestInfo.checkOutDate).toLocaleDateString()}
                                    </p>
                                </div>
                            )}

                            {selectedRoom.guestInfo.specialRequests && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Special Requests
                                    </label>
                                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                                        <p className="text-blue-800 dark:text-blue-200 text-sm">
                                            {selectedRoom.guestInfo.specialRequests}
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Checked-in By
                                </label>
                                <p className="text-navy-700 dark:text-white">
                                    {selectedRoom.guestInfo.checkedInBy || 'Unknown'}
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Check-in Time
                                </label>
                                <p className="text-navy-700 dark:text-white">
                                    {selectedRoom.guestInfo.checkedInAt ? 
                                        (selectedRoom.guestInfo.checkedInAt.toDate ? 
                                            selectedRoom.guestInfo.checkedInAt.toDate().toLocaleString() :
                                            new Date(selectedRoom.guestInfo.checkedInAt).toLocaleString()) : 
                                        'Not specified'}
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <button
                                onClick={() => setShowGuestDetailsModal(false)}
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                        </div>
                    </div>
                </div>
            )}

            {(() => {
                const checkoutFooter = (
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={() => setShowCheckoutModal(false)}
                            className="flex-1 al-btn-secondary"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            disabled={updating}
                            onClick={confirmCheckout}
                            className="flex-1 al-btn-danger"
                        >
                            Confirm checkout
                        </button>
                    </div>
                );

                const checkoutContent = checkoutRoom ? (
                    <>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                            Room <strong>{checkoutRoom.roomNumber}</strong>
                            {checkoutRoom.guestInfo?.guestName ? ` · ${checkoutRoom.guestInfo.guestName}` : ""}
                        </p>

                        <div className="mt-4">
                            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Extra charges reason
                            </label>
                            <select
                                value={checkoutReason}
                                onChange={(e) => setCheckoutReason(e.target.value)}
                                className="al-input"
                            >
                                <option value="damages">Damages</option>
                                <option value="minibar">Minibar</option>
                                <option value="late_checkout">Late checkout</option>
                                <option value="other">Other</option>
                            </select>
                        </div>

                        <div className="mt-4">
                            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Extra charges (₹)
                            </label>
                            <input
                                type="number"
                                min="0"
                                inputMode="numeric"
                                value={checkoutExtraCharges}
                                onChange={(e) => setCheckoutExtraCharges(e.target.value)}
                                className="al-input"
                                placeholder="0"
                            />
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                Damages, minibar, late checkout, etc.
                            </p>
                        </div>

                        <div className="mt-4 rounded-2xl bg-gray-50 p-4 text-sm text-gray-700 dark:bg-navy-900 dark:text-gray-200">
                            <div className="flex items-center justify-between">
                                <span>Room rate (per night)</span>
                                <span className="font-semibold">₹{Number(checkoutRoom.price || 0) || 0}</span>
                            </div>
                            <div className="mt-1 flex items-center justify-between">
                                <span>Extra charges</span>
                                <span className="font-semibold">₹{Number(checkoutExtraCharges || 0) || 0}</span>
                            </div>
                            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                Final total is calculated automatically on checkout.
                            </p>
                        </div>
                    </>
                ) : null;

                return (
                    <>
                        <div className="md:hidden">
                            <BottomSheet
                                open={showCheckoutModal && !!checkoutRoom}
                                title={checkoutRoom ? `Checkout · Room ${checkoutRoom.roomNumber}` : "Checkout"}
                                onClose={() => setShowCheckoutModal(false)}
                                footer={checkoutFooter}
                            >
                                {checkoutContent}
                            </BottomSheet>
                        </div>

                        <div className="hidden md:block">
                            <Modal
                                open={showCheckoutModal && !!checkoutRoom}
                                title={checkoutRoom ? `Checkout · Room ${checkoutRoom.roomNumber}` : "Checkout"}
                                onClose={() => setShowCheckoutModal(false)}
                                maxWidthClass="max-w-md"
                                footer={checkoutFooter}
                            >
                                {checkoutContent}
                            </Modal>
                        </div>
                    </>
                );
            })()}

            {updating && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-4">
                    <div className="min-h-full flex items-center justify-center py-6">
                        <div className="bg-white dark:bg-navy-800 p-6 rounded-2xl shadow-lg max-w-md w-full">
                        <div className="flex items-center gap-3">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-500"></div>
                            <span className="text-navy-700 dark:text-white">Updating room status...</span>
                        </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StaffRoomManagement;