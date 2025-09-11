import React, { useState, useEffect } from "react";
import { collection, getDocs, getDoc, doc, addDoc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp, limit } from "firebase/firestore";
import { db } from "../../../firebase/config";
import { useAuth } from "contexts/AuthContext";
import ComplexTable from "views/admin/default/components/ComplexTable";
import InputField from "components/fields/InputField";
import {
    MdHotel,
    MdAdd,
    MdEdit,
    MdDelete,
    MdCheckCircle,
    MdCancel,
    MdBuild,
    MdPerson,
    MdEventAvailable,
    MdEventBusy,
    MdRefresh
} from "react-icons/md";

const RoomManagement = () => {
    const { currentUser } = useAuth();
    const [rooms, setRooms] = useState([]);
    const [recentActions, setRecentActions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [formData, setFormData] = useState({
        roomNumber: '',
        roomType: 'Standard',
        floor: '',
        price: '',
        amenities: [],
        description: ''
    });

    const roomTypes = ['Standard', 'Deluxe', 'Suite', 'Presidential'];
    const roomAmenities = ['WiFi', 'TV', 'AC', 'Mini Bar', 'Safe', 'Balcony', 'Sea View', 'City View', 'Jacuzzi', 'Kitchenette'];

    useEffect(() => {
        if (currentUser) {
            fetchRooms();
            fetchRecentActions();
        }
    }, [currentUser]);

    const fetchRooms = async () => {
        try {
            setLoading(true);

            // Get hotel ID for current owner
            const ownerSnap = await getDocs(query(collection(db, "users"), where("uid", "==", currentUser.uid), limit(1)));
            const ownerDocId = ownerSnap.docs[0]?.id;

            const hotelSnap = await getDocs(query(collection(db, "hotels"), where("ownerId", "==", ownerDocId), limit(1)));
            const hotelId = hotelSnap.docs[0]?.id;

            if (!hotelId) {
                console.error("No hotel ID found for user");
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

    const fetchRecentActions = async () => {
        try {
            // Get hotel ID using the same logic as staff management
            const ownerSnap = await getDocs(query(collection(db, "users"), where("uid", "==", currentUser.uid), limit(1)));
            const ownerDocId = ownerSnap.docs[0]?.id;
            console.log('Owner doc ID:', ownerDocId);

            // Find the hotel owned by this owner document id
            const hotelSnap = await getDocs(query(collection(db, "hotels"), where("ownerId", "==", ownerDocId), limit(1)));
            const hotelId = hotelSnap.docs[0]?.id;
            console.log('Hotel ID (document ID):', hotelId);

            if (!hotelId) {
                console.error("No hotel ID found for owner");
                return;
            }

            // Fetch recent staff actions for this hotel
            const actionsQuery = query(
                collection(db, "staff_actions"),
                where("hotelId", "==", hotelId)
            );
            const actionsSnapshot = await getDocs(actionsQuery);
            console.log('Actions snapshot size:', actionsSnapshot.docs.length);
            
            const actionsData = actionsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            console.log('Actions data:', actionsData);

            // Sort by timestamp in JavaScript to avoid Firebase index issues
            actionsData.sort((a, b) => {
                const dateA = a.timestamp?.toDate() || new Date(0);
                const dateB = b.timestamp?.toDate() || new Date(0);
                return dateB - dateA; // Most recent first
            });

            // Get staff names for each action
            const actionsWithStaffNames = await Promise.all(
                actionsData.slice(0, 20).map(async (action) => {
                    try {
                        const staffDoc = await getDoc(doc(db, "users", action.staffId));
                        const staffData = staffDoc.exists() ? staffDoc.data() : {};
                        return {
                            ...action,
                            staffName: staffData.displayName || 'Unknown Staff'
                        };
                    } catch (error) {
                        console.error('Error fetching staff name:', error);
                        return {
                            ...action,
                            staffName: 'Unknown Staff'
                        };
                    }
                })
            );

            console.log('Actions with staff names:', actionsWithStaffNames);
            setRecentActions(actionsWithStaffNames);
        } catch (error) {
            console.error("Error fetching recent actions:", error);
        }
    };

    const addTestAction = async () => {
        try {
            // Get hotel ID using the same logic as staff management
            const ownerSnap = await getDocs(query(collection(db, "users"), where("uid", "==", currentUser.uid), limit(1)));
            const ownerDocId = ownerSnap.docs[0]?.id;

            // Find the hotel owned by this owner document id
            const hotelSnap = await getDocs(query(collection(db, "hotels"), where("ownerId", "==", ownerDocId), limit(1)));
            const hotelId = hotelSnap.docs[0]?.id;
            
            if (!hotelId) {
                console.error("No hotel ID found for owner");
                return;
            }

            const testActionData = {
                staffId: currentUser.uid, // Using owner's ID for test
                hotelId: hotelId,
                roomId: 'test-room-id',
                roomNumber: '101',
                actionType: 'test_action',
                description: 'Test action created by owner for debugging',
                timestamp: serverTimestamp(),
                guestInfo: null
            };

            await addDoc(collection(db, "staff_actions"), testActionData);
            console.log('Test action added successfully');
            
            // Refresh the actions list
            fetchRecentActions();
        } catch (error) {
            console.error("Error adding test action:", error);
        }
    };

    const handleAddRoom = async (e) => {
        e.preventDefault();
        try {
            // Get hotel ID for current owner
            const ownerSnap = await getDocs(query(collection(db, "users"), where("uid", "==", currentUser.uid), limit(1)));
            const ownerDocId = ownerSnap.docs[0]?.id;

            const hotelSnap = await getDocs(query(collection(db, "hotels"), where("ownerId", "==", ownerDocId), limit(1)));
            const hotelId = hotelSnap.docs[0]?.id;

            if (!hotelId) {
                console.error("No hotel ID found for user");
                return;
            }

            // Check if room number already exists
            const existingRoom = rooms.find(room => room.roomNumber === formData.roomNumber);
            if (existingRoom) {
                alert("Room number already exists!");
                return;
            }

            // Create room document
            await addDoc(collection(db, "rooms"), {
                ...formData,
                hotelId,
                price: parseFloat(formData.price),
                floor: parseInt(formData.floor),
                status: 'available',
                isActive: true,
                createdAt: serverTimestamp(),
                createdBy: currentUser.uid
            });

            setShowAddModal(false);
            setFormData({ roomNumber: '', roomType: 'Standard', floor: '', price: '', amenities: [], description: '' });
            fetchRooms();
        } catch (error) {
            console.error("Error adding room:", error);
        }
    };

    const handleEditRoom = async (e) => {
        e.preventDefault();
        try {
            const roomRef = doc(db, "rooms", selectedRoom.id);
            await updateDoc(roomRef, {
                ...formData,
                price: parseFloat(formData.price),
                floor: parseInt(formData.floor),
                updatedAt: serverTimestamp(),
                updatedBy: currentUser.uid
            });

            setShowEditModal(false);
            setSelectedRoom(null);
            setFormData({ roomNumber: '', roomType: 'Standard', floor: '', price: '', amenities: [], description: '' });
            fetchRooms();
        } catch (error) {
            console.error("Error updating room:", error);
        }
    };

    const handleDeleteRoom = async (roomId) => {
        if (window.confirm("Are you sure you want to delete this room?")) {
            try {
                await deleteDoc(doc(db, "rooms", roomId));
                fetchRooms();
            } catch (error) {
                console.error("Error deleting room:", error);
            }
        }
    };

    const updateRoomStatus = async (roomId, newStatus) => {
        try {
            const roomRef = doc(db, "rooms", roomId);
            await updateDoc(roomRef, {
                status: newStatus,
                updatedAt: serverTimestamp(),
                updatedBy: currentUser.uid
            });
            fetchRooms();
        } catch (error) {
            console.error("Error updating room status:", error);
        }
    };

    const openEditModal = (room) => {
        setSelectedRoom(room);
        setFormData({
            roomNumber: room.roomNumber,
            roomType: room.roomType,
            floor: room.floor.toString(),
            price: room.price.toString(),
            amenities: room.amenities || [],
            description: room.description || ''
        });
        setShowEditModal(true);
    };

    const handleAmenityChange = (amenity) => {
        setFormData(prev => ({
            ...prev,
            amenities: prev.amenities.includes(amenity)
                ? prev.amenities.filter(a => a !== amenity)
                : [...prev.amenities, amenity]
        }));
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'available': return 'bg-green-100 text-green-800';
            case 'occupied': return 'bg-red-100 text-red-800';
            case 'maintenance': return 'bg-yellow-100 text-yellow-800';
            case 'checked-in': return 'bg-blue-100 text-blue-800';
            case 'checked-out': return 'bg-gray-100 text-gray-800';
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
            default: return <MdEventAvailable className="h-4 w-4" />;
        }
    };

    const roomColumns = [
        { Header: "Room #", accessor: "roomNumber" },
        { Header: "Type", accessor: "roomType" },
        { Header: "Floor", accessor: "floor" },
        { Header: "Price", accessor: "price" },
        { Header: "Status", accessor: "status" },
        { Header: "Amenities", accessor: "amenities" },
        { Header: "Actions", accessor: "actions" },
    ];

    const actionColumns = [
        { Header: "Staff Member", accessor: "staffName" },
        { Header: "Action", accessor: "actionType" },
        { Header: "Room", accessor: "roomNumber" },
        { Header: "Details", accessor: "description" },
        { Header: "Timestamp", accessor: "timestamp" },
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
            amenities: (
                <div className="flex flex-wrap gap-1">
                    {room.amenities?.slice(0, 3).map((amenity, index) => (
                        <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                            {amenity}
                        </span>
                    ))}
                    {room.amenities?.length > 3 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                            +{room.amenities.length - 3} more
                        </span>
                    )}
                </div>
            ),
            actions: (
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => openEditModal(room)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="Edit Room"
                    >
                        <MdEdit className="h-4 w-4" />
                    </button>
                    <button
                        onClick={() => handleDeleteRoom(room.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        title="Delete Room"
                    >
                        <MdDelete className="h-4 w-4" />
                    </button>
                </div>
            )
        }));
    };

    const formatActionData = (actions) => {
        return actions.map(action => ({
            ...action,
            staffName: action.staffName || 'Unknown Staff',
            actionType: action.actionType ? 
                action.actionType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 
                'Unknown Action',
            roomNumber: action.roomNumber || 'N/A',
            description: action.description || 'No details available',
            timestamp: action.timestamp ? 
                (action.timestamp.toDate ? 
                    action.timestamp.toDate().toLocaleString() :
                    new Date(action.timestamp).toLocaleString()) : 
                'Unknown time'
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
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-white hover:bg-brand-600"
                >
                    <MdAdd className="h-4 w-4" />
                    Add Room
                </button>
            </div>

            {/* Room Status Summary */}
            <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
                {['available', 'occupied', 'maintenance', 'checked-in', 'checked-out'].map(status => {
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

            <ComplexTable
                columnsData={roomColumns}
                tableData={formatData(rooms)}
            />

            {/* Recent Staff Actions */}
            <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-navy-700 dark:text-white">
                        Recent Staff Actions
                    </h3>
                    <button
                        onClick={fetchRecentActions}
                        className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-gray-700 hover:bg-gray-200 dark:bg-navy-700 dark:text-white dark:hover:bg-navy-600"
                        title="Refresh actions"
                    >
                        <MdRefresh className="h-4 w-4" />
                        Refresh
                    </button>
                </div>
                {recentActions.length > 0 ? (
                    <ComplexTable
                        columnsData={actionColumns}
                        tableData={formatActionData(recentActions)}
                    />
                ) : (
                    <div className="bg-white dark:bg-navy-800 p-6 rounded-lg shadow text-center">
                        <p className="text-gray-500 dark:text-gray-400">
                            No staff actions found. Actions will appear here when staff members perform room management tasks.
                        </p>
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={fetchRecentActions}
                                className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600"
                            >
                                Refresh Actions
                            </button>
                            <button
                                onClick={addTestAction}
                                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                            >
                                Add Test Action
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Add Room Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 dark:bg-navy-800">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-xl font-bold text-navy-700 dark:text-white">
                                Add New Room
                            </h3>
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <MdCancel className="h-6 w-6" />
                            </button>
                        </div>

                        <form onSubmit={handleAddRoom} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <InputField
                                    label="Room Number*"
                                    placeholder="101"
                                    value={formData.roomNumber}
                                    onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                                    required
                                />

                                <InputField
                                    label="Floor*"
                                    type="number"
                                    placeholder="1"
                                    value={formData.floor}
                                    onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-navy-700 dark:text-white mb-2">
                                        Room Type*
                                    </label>
                                    <select
                                        value={formData.roomType}
                                        onChange={(e) => setFormData({ ...formData, roomType: e.target.value })}
                                        className="w-full p-3 border border-gray-200 rounded-xl dark:border-white/10 dark:bg-navy-800 dark:text-white"
                                        required
                                    >
                                        {roomTypes.map(type => (
                                            <option key={type} value={type}>{type}</option>
                                        ))}
                                    </select>
                                </div>

                                <InputField
                                    label="Price per Night (₹)*"
                                    type="number"
                                    placeholder="2500"
                                    value={formData.price}
                                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-navy-700 dark:text-white mb-2">
                                    Amenities
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {roomAmenities.map(amenity => (
                                        <label key={amenity} className="flex items-center">
                                            <input
                                                type="checkbox"
                                                checked={formData.amenities.includes(amenity)}
                                                onChange={() => handleAmenityChange(amenity)}
                                                className="mr-2"
                                            />
                                            <span className="text-sm text-navy-700 dark:text-white">{amenity}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <InputField
                                label="Description"
                                placeholder="Room description..."
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />

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
                                    Add Room
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Room Modal */}
            {showEditModal && selectedRoom && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 dark:bg-navy-800">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-xl font-bold text-navy-700 dark:text-white">
                                Edit Room - {selectedRoom.roomNumber}
                            </h3>
                            <button
                                onClick={() => setShowEditModal(false)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <MdCancel className="h-6 w-6" />
                            </button>
                        </div>

                        <form onSubmit={handleEditRoom} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <InputField
                                    label="Room Number*"
                                    placeholder="101"
                                    value={formData.roomNumber}
                                    onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                                    required
                                />

                                <InputField
                                    label="Floor*"
                                    type="number"
                                    placeholder="1"
                                    value={formData.floor}
                                    onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-navy-700 dark:text-white mb-2">
                                        Room Type*
                                    </label>
                                    <select
                                        value={formData.roomType}
                                        onChange={(e) => setFormData({ ...formData, roomType: e.target.value })}
                                        className="w-full p-3 border border-gray-200 rounded-xl dark:border-white/10 dark:bg-navy-800 dark:text-white"
                                        required
                                    >
                                        {roomTypes.map(type => (
                                            <option key={type} value={type}>{type}</option>
                                        ))}
                                    </select>
                                </div>

                                <InputField
                                    label="Price per Night (₹)*"
                                    type="number"
                                    placeholder="2500"
                                    value={formData.price}
                                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-navy-700 dark:text-white mb-2">
                                    Current Status
                                </label>
                                <div className="flex gap-2 flex-wrap">
                                    {['available', 'occupied', 'maintenance', 'checked-in', 'checked-out'].map(status => (
                                        <button
                                            key={status}
                                            type="button"
                                            onClick={() => updateRoomStatus(selectedRoom.id, status)}
                                            className={`px-3 py-1 rounded-full text-sm font-medium ${
                                                selectedRoom.status === status
                                                    ? getStatusColor(status)
                                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                        >
                                            {status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-navy-700 dark:text-white mb-2">
                                    Amenities
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {roomAmenities.map(amenity => (
                                        <label key={amenity} className="flex items-center">
                                            <input
                                                type="checkbox"
                                                checked={formData.amenities.includes(amenity)}
                                                onChange={() => handleAmenityChange(amenity)}
                                                className="mr-2"
                                            />
                                            <span className="text-sm text-navy-700 dark:text-white">{amenity}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <InputField
                                label="Description"
                                placeholder="Room description..."
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowEditModal(false)}
                                    className="flex-1 rounded-lg bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 rounded-lg bg-brand-500 px-4 py-2 text-white hover:bg-brand-600"
                                >
                                    Update Room
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RoomManagement;
