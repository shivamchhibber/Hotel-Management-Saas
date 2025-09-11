import React, { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc, addDoc, query, where, orderBy, serverTimestamp, limit } from "firebase/firestore";
import { db } from "../../../firebase/config";
import { useAuth } from "contexts/AuthContext";
import ComplexTable from "views/admin/default/components/ComplexTable";
import {
    MdHotel,
    MdBuild,
    MdPerson,
    MdEventAvailable,
    MdEventBusy,
    MdCheckCircle,
    MdRefresh,
    MdLogin,
    MdExitToApp,
    MdInfo,
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
    const [guestForm, setGuestForm] = useState({
        guestName: '',
        guestEmail: '',
        guestPhone: '',
        guestId: '',
        checkInDate: '',
        checkOutDate: '',
        numberOfGuests: 1,
        specialRequests: ''
    });

    useEffect(() => {
        if (currentUser) {
            fetchRooms();
        }
    }, [currentUser]);

    const fetchRooms = async () => {
        try {
            setLoading(true);

            // Get hotel ID for current staff member
            const staffSnap = await getDocs(query(collection(db, "users"), where("uid", "==", currentUser.uid), limit(1)));
            const staffDoc = staffSnap.docs[0];
            
            if (!staffDoc) {
                console.error("Staff document not found");
                return;
            }

            const staffData = staffDoc.data();
            const hotelId = staffData.hotelId;

            if (!hotelId) {
                console.error("No hotel ID found for staff member");
                return;
            }

            // Fetch rooms for this hotel
            const roomsQuery = query(
                collection(db, "rooms"),
                where("hotelId", "==", hotelId)
            );
            const roomsSnapshot = await getDocs(roomsQuery);
            const roomsData = roomsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            // Sort rooms by room number in JavaScript
            roomsData.sort((a, b) => {
                const roomA = parseInt(a.roomNumber) || 0;
                const roomB = parseInt(b.roomNumber) || 0;
                return roomA - roomB;
            });
            setRooms(roomsData);
        } catch (error) {
            console.error("Error fetching rooms:", error);
        } finally {
            setLoading(false);
        }
    };

    const updateRoomStatus = async (roomId, newStatus, guestInfo = null) => {
        try {
            setUpdating(true);
            const roomRef = doc(db, "rooms", roomId);
            const updateData = {
                status: newStatus,
                updatedAt: serverTimestamp(),
                updatedBy: currentUser.uid
            };

            // If checking in, add guest information
            if (newStatus === 'checked-in' && guestInfo) {
                updateData.guestInfo = guestInfo;
                updateData.checkInDate = serverTimestamp();
            }

            // If checking out, clear guest information
            if (newStatus === 'checked-out') {
                updateData.guestInfo = null;
                updateData.checkOutDate = serverTimestamp();
            }

            await updateDoc(roomRef, updateData);
            
            // Log the action
            await logStaffAction(roomId, newStatus, guestInfo);
            
            // Update local state
            setRooms(rooms.map(room =>
                room.id === roomId
                    ? { ...room, status: newStatus, ...updateData }
                    : room
            ));
        } catch (error) {
            console.error("Error updating room status:", error);
            alert("Error updating room status: " + error.message);
        } finally {
            setUpdating(false);
        }
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
            guestId: '',
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
                ...guestForm,
                checkInDate: new Date(guestForm.checkInDate),
                checkOutDate: guestForm.checkOutDate ? new Date(guestForm.checkOutDate) : null,
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
                        onClick={() => updateRoomStatus(room.id, 'checked-out')}
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
                        onClick={() => updateRoomStatus(room.id, 'checked-out')}
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

            <ComplexTable
                columnsData={roomColumns}
                tableData={formatData(rooms)}
            />

            {/* Check-in Modal */}
            {showCheckInModal && selectedRoom && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="bg-white dark:bg-navy-800 p-6 rounded-lg shadow-lg w-full max-w-md">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-navy-700 dark:text-white">
                                Check-in Guest - Room {selectedRoom.roomNumber}
                            </h3>
                            <button
                                onClick={() => setShowCheckInModal(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <MdClose className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCheckInSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Guest Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={guestForm.guestName}
                                    onChange={(e) => setGuestForm({...guestForm, guestName: e.target.value})}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
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
                                    onChange={(e) => setGuestForm({...guestForm, guestEmail: e.target.value})}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
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
                                    onChange={(e) => setGuestForm({...guestForm, guestPhone: e.target.value})}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
                                    placeholder="+91 9876543210"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    ID Number
                                </label>
                                <input
                                    type="text"
                                    value={guestForm.guestId}
                                    onChange={(e) => setGuestForm({...guestForm, guestId: e.target.value})}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
                                    placeholder="Aadhar/PAN/Passport number"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Check-in Date *
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={guestForm.checkInDate}
                                        onChange={(e) => setGuestForm({...guestForm, checkInDate: e.target.value})}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Check-out Date
                                    </label>
                                    <input
                                        type="date"
                                        value={guestForm.checkOutDate}
                                        onChange={(e) => setGuestForm({...guestForm, checkOutDate: e.target.value})}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
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
                                    onChange={(e) => setGuestForm({...guestForm, numberOfGuests: parseInt(e.target.value)})}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Special Requests
                                </label>
                                <textarea
                                    value={guestForm.specialRequests}
                                    onChange={(e) => setGuestForm({...guestForm, specialRequests: e.target.value})}
                                    rows="3"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
                                    placeholder="Any special requests or notes..."
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowCheckInModal(false)}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={updating}
                                    className="flex-1 px-4 py-2 bg-brand-500 text-white rounded-md hover:bg-brand-600 disabled:opacity-50 transition-colors"
                                >
                                    {updating ? 'Processing...' : 'Check-in Guest'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Guest Details Modal */}
            {showGuestDetailsModal && selectedRoom && selectedRoom.guestInfo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="bg-white dark:bg-navy-800 p-6 rounded-lg shadow-lg w-full max-w-md">
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
            )}

            {updating && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="bg-white dark:bg-navy-800 p-6 rounded-lg shadow-lg">
                        <div className="flex items-center gap-3">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-500"></div>
                            <span className="text-navy-700 dark:text-white">Updating room status...</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StaffRoomManagement;