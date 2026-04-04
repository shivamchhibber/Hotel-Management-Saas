import React, { useState, useEffect } from "react";
import { collection, getDocs, addDoc, updateDoc, doc, query, where, orderBy } from "firebase/firestore";
import { db } from "../../../firebase/config";
import { useAuth } from "contexts/AuthContext";
import InputField from "components/fields/InputField";
import {
    MdLogin,
    MdLogout,
    MdSearch,
    MdPerson,
    MdRoom,
    MdCalendarToday,
    MdAttachMoney
} from "react-icons/md";

const CheckinCheckout = () => {
    const { currentUser } = useAuth();
    const [activeTab, setActiveTab] = useState("checkin");
    const [guests, setGuests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        guestName: '',
        email: '',
        phoneNumber: '',
        roomNumber: '',
        checkInDate: '',
        checkOutDate: '',
        amount: '',
        idProof: '',
        address: ''
    });

    useEffect(() => {
        if (currentUser) {
            fetchGuests();
        }
    }, [currentUser]);

    const fetchGuests = async () => {
        try {
            setLoading(true);

            // Get user's hotel ID
            const userDoc = await getDocs(query(collection(db, "users"), where("uid", "==", currentUser.uid)));
            const userData = userDoc.docs[0]?.data();
            const hotelId = userData?.hotelId;

            if (!hotelId) {
                console.error("No hotel ID found for user");
                return;
            }

            // Fetch guests for this hotel
            const guestsQuery = query(
                collection(db, "guests"),
                where("hotelId", "==", hotelId),
                orderBy("createdAt", "desc")
            );
            const guestsSnapshot = await getDocs(guestsQuery);
            const guestsData = guestsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setGuests(guestsData);
        } catch (error) {
            console.error("Error fetching guests:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCheckIn = async (e) => {
        e.preventDefault();
        try {
            // Get user's hotel ID
            const userDoc = await getDocs(query(collection(db, "users"), where("uid", "==", currentUser.uid)));
            const userData = userDoc.docs[0]?.data();
            const hotelId = userData?.hotelId;

            // Create guest record
            const guestData = {
                ...formData,
                hotelId,
                isCheckedIn: true,
                checkInDate: new Date(formData.checkInDate),
                checkOutDate: new Date(formData.checkOutDate),
                amount: parseFloat(formData.amount),
                createdAt: new Date(),
                createdBy: currentUser.uid
            };

            const guestRef = await addDoc(collection(db, "guests"), guestData);

            // Create check-in record
            await addDoc(collection(db, "checkins"), {
                guestId: guestRef.id,
                hotelId,
                guestName: formData.guestName,
                roomNumber: formData.roomNumber,
                checkInDate: new Date(formData.checkInDate),
                amount: parseFloat(formData.amount),
                staffId: currentUser.uid,
                createdAt: new Date()
            });

            // Create activity log
            await addDoc(collection(db, "activity_logs"), {
                hotelId,
                action: 'check_in',
                guestName: formData.guestName,
                roomNumber: formData.roomNumber,
                staffId: currentUser.uid,
                timestamp: new Date()
            });

            setShowModal(false);
            setFormData({
                guestName: '',
                email: '',
                phoneNumber: '',
                roomNumber: '',
                checkInDate: '',
                checkOutDate: '',
                amount: '',
                idProof: '',
                address: ''
            });
            fetchGuests();
        } catch (error) {
            console.error("Error checking in guest:", error);
        }
    };

    const handleCheckOut = async (guestId) => {
        try {
            const guest = guests.find(g => g.id === guestId);
            if (!guest) return;

            // Update guest record
            await updateDoc(doc(db, "guests", guestId), {
                isCheckedIn: false,
                checkOutDate: new Date(),
                updatedAt: new Date()
            });

            // Create check-out record
            await addDoc(collection(db, "checkouts"), {
                guestId,
                hotelId: guest.hotelId,
                guestName: guest.name,
                roomNumber: guest.roomNumber,
                checkOutDate: new Date(),
                amount: guest.amount,
                staffId: currentUser.uid,
                createdAt: new Date()
            });

            // Create activity log
            await addDoc(collection(db, "activity_logs"), {
                hotelId: guest.hotelId,
                action: 'check_out',
                guestName: guest.name,
                roomNumber: guest.roomNumber,
                staffId: currentUser.uid,
                timestamp: new Date()
            });

            fetchGuests();
        } catch (error) {
            console.error("Error checking out guest:", error);
        }
    };

    const filteredGuests = guests.filter(guest => {
        if (activeTab === "checkin") {
            return !guest.isCheckedIn &&
                (guest.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    guest.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    guest.phoneNumber?.includes(searchTerm));
        } else {
            return guest.isCheckedIn &&
                (guest.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    guest.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    guest.phoneNumber?.includes(searchTerm));
        }
    });

    const formatDate = (date) => {
        if (!date) return 'N/A';
        const dateObj = date.toDate ? date.toDate() : new Date(date);
        return dateObj.toLocaleDateString();
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(amount);
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
                    Check-in / Check-out Management
                </h2>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-white hover:bg-brand-600"
                >
                    <MdLogin className="h-4 w-4" />
                    New Check-in
                </button>
            </div>

            {/* Tabs */}
            <div className="mb-6 flex rounded-lg bg-gray-100 p-1">
                <button
                    onClick={() => setActiveTab("checkin")}
                    className={`flex-1 rounded-md py-2 text-sm font-medium ${activeTab === "checkin"
                        ? "bg-white text-brand-500 shadow-sm"
                        : "text-gray-600"
                        }`}
                >
                    Check-in Guests
                </button>
                <button
                    onClick={() => setActiveTab("checkout")}
                    className={`flex-1 rounded-md py-2 text-sm font-medium ${activeTab === "checkout"
                        ? "bg-white text-brand-500 shadow-sm"
                        : "text-gray-600"
                        }`}
                >
                    Check-out Guests
                </button>
            </div>

            {/* Search */}
            <div className="mb-6">
                <div className="relative">
                    <MdSearch className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search guests..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-gray-700 focus:border-brand-500 focus:outline-none dark:border-gray-600 dark:bg-navy-800 dark:text-white"
                    />
                </div>
            </div>

            {/* Guest List */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredGuests.map((guest) => (
                    <div key={guest.id} className="rounded-lg bg-white p-6 shadow-sm dark:bg-navy-800">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-navy-700 dark:text-white">
                                {guest.name}
                            </h3>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${guest.isCheckedIn
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                                }`}>
                                {guest.isCheckedIn ? 'Checked In' : 'Checked Out'}
                            </span>
                        </div>

                        <div className="space-y-2 text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                                <MdPerson className="h-4 w-4" />
                                <span>{guest.email}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <MdRoom className="h-4 w-4" />
                                <span>Room {guest.roomNumber}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <MdCalendarToday className="h-4 w-4" />
                                <span>Check-in: {formatDate(guest.checkInDate)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <MdAttachMoney className="h-4 w-4" />
                                <span>{formatCurrency(guest.amount || 0)}</span>
                            </div>
                        </div>

                        {activeTab === "checkout" && guest.isCheckedIn && (
                            <button
                                onClick={() => handleCheckOut(guest.id)}
                                className="mt-4 w-full rounded-lg bg-red-500 px-4 py-2 text-white hover:bg-red-600"
                            >
                                Check Out
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {/* Check-in Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="w-full max-w-2xl rounded-lg bg-white p-6 dark:bg-navy-800">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-xl font-bold text-navy-700 dark:text-white">
                                New Check-in
                            </h3>
                            <button
                                onClick={() => setShowModal(false)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                ×
                            </button>
                        </div>

                        <form onSubmit={handleCheckIn} className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <InputField
                                    label="Guest Name*"
                                    placeholder="Enter guest name"
                                    value={formData.guestName}
                                    onChange={(e) => setFormData({ ...formData, guestName: e.target.value })}
                                    required
                                />

                                <InputField
                                    label="Email*"
                                    type="email"
                                    placeholder="Enter email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    required
                                />

                                <InputField
                                    label="Phone Number*"
                                    type="tel"
                                    placeholder="Enter phone number"
                                    value={formData.phoneNumber}
                                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                                    required
                                />

                                <InputField
                                    label="Room Number*"
                                    placeholder="Enter room number"
                                    value={formData.roomNumber}
                                    onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                                    required
                                />

                                <InputField
                                    label="Check-in Date*"
                                    type="date"
                                    value={formData.checkInDate}
                                    onChange={(e) => setFormData({ ...formData, checkInDate: e.target.value })}
                                    required
                                />

                                <InputField
                                    label="Check-out Date*"
                                    type="date"
                                    value={formData.checkOutDate}
                                    onChange={(e) => setFormData({ ...formData, checkOutDate: e.target.value })}
                                    required
                                />

                                <InputField
                                    label="Amount*"
                                    type="number"
                                    placeholder="Enter amount"
                                    value={formData.amount}
                                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                    required
                                />

                                <InputField
                                    label="ID Proof"
                                    placeholder="Enter ID proof details"
                                    value={formData.idProof}
                                    onChange={(e) => setFormData({ ...formData, idProof: e.target.value })}
                                />
                            </div>

                            <InputField
                                label="Address"
                                placeholder="Enter address"
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            />

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 rounded-lg bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 rounded-lg bg-brand-500 px-4 py-2 text-white hover:bg-brand-600"
                                >
                                    Check In
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CheckinCheckout;
