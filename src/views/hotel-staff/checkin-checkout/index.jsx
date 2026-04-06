import React, { useState, useEffect } from "react";
import { collection, getDocs, addDoc, updateDoc, doc, query, where, orderBy } from "firebase/firestore";
import { db } from "../../../firebase/config";
import { useAuth } from "contexts/AuthContext";
import { getHotelIdFromUserProfile } from "utils/userProfileUtils";
import { staffListGuestsFn } from "utils/staffCallables";
import GuestIdCaptureBlock from "components/guest/GuestIdCaptureBlock";
import InputField from "components/fields/InputField";
import Modal from "components/ui/Modal";
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
    const [showCheckoutModal, setShowCheckoutModal] = useState(false);
    const [checkoutGuest, setCheckoutGuest] = useState(null);
    const [checkoutExtraCharges, setCheckoutExtraCharges] = useState("0");
    const [checkoutReason, setCheckoutReason] = useState("damages");
    const [formData, setFormData] = useState({
        guestName: '',
        email: '',
        phoneNumber: '',
        roomNumber: '',
        checkInDate: '',
        checkOutDate: '',
        amount: '',
        idDocumentType: 'aadhaar',
        idDocumentNumber: '',
        idImages: [],
        address: ''
    });
    const [staffHotelId, setStaffHotelId] = useState(null);

    useEffect(() => {
        if (currentUser) {
            fetchGuests();
        }
    }, [currentUser]);

    useEffect(() => {
        let cancelled = false;
        if (!currentUser?.uid) return undefined;
        (async () => {
            const hid = await getHotelIdFromUserProfile(currentUser.uid);
            if (!cancelled) setStaffHotelId(hid);
        })();
        return () => {
            cancelled = true;
        };
    }, [currentUser]);

    const fetchGuests = async () => {
        try {
            setLoading(true);

            let guestsData = [];
            try {
                const { data } = await staffListGuestsFn({});
                guestsData = Array.isArray(data?.guests) ? data.guests : [];
            } catch (callableErr) {
                console.warn("staffListGuests failed; falling back to Firestore query:", callableErr);
                const hotelId = await getHotelIdFromUserProfile(currentUser.uid);
                if (!hotelId) {
                    console.error("No hotel ID on users/{uid}; staff profile missing hotelId.");
                    setGuests([]);
                    return;
                }
                const guestsQuery = query(
                    collection(db, "guests"),
                    where("hotelId", "==", hotelId),
                    orderBy("createdAt", "desc"),
                );
                const guestsSnapshot = await getDocs(guestsQuery);
                guestsData = guestsSnapshot.docs.map((d) => ({
                    id: d.id,
                    ...d.data(),
                }));
            }
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
            const hotelId = await getHotelIdFromUserProfile(currentUser.uid);
            if (!hotelId) {
                console.error("No hotel ID for staff user");
                return;
            }

            const guestData = {
                guestName: formData.guestName,
                name: formData.guestName,
                email: formData.email,
                phoneNumber: formData.phoneNumber,
                roomNumber: formData.roomNumber,
                address: formData.address,
                idDocumentType: formData.idDocumentType,
                idDocumentNumber: formData.idDocumentNumber,
                idProof: formData.idDocumentNumber,
                idDocumentImages: formData.idImages.map(({ url, type, fromProfile }) => ({
                    url,
                    type: type || formData.idDocumentType,
                    fromProfile: !!fromProfile,
                })),
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
                guestEmail: formData.email,
                guestPhone: formData.phoneNumber,
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
                idDocumentType: 'aadhaar',
                idDocumentNumber: '',
                idImages: [],
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
                guestName: guest.name || guest.guestName,
                roomNumber: guest.roomNumber,
                checkOutDate: new Date(),
                amount: guest.amount,
                additionalCharges: Number(checkoutExtraCharges || 0) || 0,
                additionalChargeReason: checkoutReason,
                totalAmount: (Number(guest.amount || 0) || 0) + (Number(checkoutExtraCharges || 0) || 0),
                staffId: currentUser.uid,
                createdAt: new Date()
            });

            // Create activity log
            await addDoc(collection(db, "activity_logs"), {
                hotelId: guest.hotelId,
                action: 'check_out',
                guestName: guest.name || guest.guestName,
                roomNumber: guest.roomNumber,
                staffId: currentUser.uid,
                timestamp: new Date()
            });

            fetchGuests();
        } catch (error) {
            console.error("Error checking out guest:", error);
        } finally {
            setShowCheckoutModal(false);
            setCheckoutGuest(null);
        }
    };

    const openCheckoutModal = (guest) => {
        setCheckoutGuest(guest);
        setCheckoutExtraCharges("0");
        setCheckoutReason("damages");
        setShowCheckoutModal(true);
    };

    const filteredGuests = guests.filter(guest => {
        const nm = (guest.name || guest.guestName || "").toLowerCase();
        const em = (guest.email || guest.guestEmail || "").toLowerCase();
        const ph = guest.phoneNumber || guest.guestPhone || "";
        if (activeTab === "checkin") {
            return !guest.isCheckedIn &&
                (nm.includes(searchTerm.toLowerCase()) ||
                    em.includes(searchTerm.toLowerCase()) ||
                    ph.includes(searchTerm));
        }
        return guest.isCheckedIn &&
            (nm.includes(searchTerm.toLowerCase()) ||
                em.includes(searchTerm.toLowerCase()) ||
                ph.includes(searchTerm));
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
                                {guest.name || guest.guestName || "Guest"}
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
                                <span>{guest.email || guest.guestEmail || "—"}</span>
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
                                onClick={() => openCheckoutModal(guest)}
                                className="mt-4 w-full rounded-lg bg-red-500 px-4 py-2 text-white hover:bg-red-600"
                            >
                                Check Out
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {/* Check-in Modal */}
            <Modal
                open={showModal}
                title="New Check-in"
                onClose={() => setShowModal(false)}
                maxWidthClass="max-w-2xl"
            >
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
                            </div>

                            <GuestIdCaptureBlock
                                staffUid={currentUser?.uid}
                                hotelId={staffHotelId}
                                email={formData.email}
                                phone={formData.phoneNumber}
                                idDocumentType={formData.idDocumentType}
                                setIdDocumentType={(v) => setFormData((f) => ({ ...f, idDocumentType: v }))}
                                idDocumentNumber={formData.idDocumentNumber}
                                setIdDocumentNumber={(v) => setFormData((f) => ({ ...f, idDocumentNumber: v }))}
                                idImages={formData.idImages}
                                setIdImages={(updater) =>
                                    setFormData((f) => ({
                                        ...f,
                                        idImages: typeof updater === "function" ? updater(f.idImages) : updater,
                                    }))
                                }
                            />

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
                                    className="flex-1 al-btn-secondary"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 al-btn-primary"
                                >
                                    Check In
                                </button>
                            </div>
                        </form>
            </Modal>

            <Modal
                open={showCheckoutModal && !!checkoutGuest}
                title="Checkout"
                onClose={() => setShowCheckoutModal(false)}
                maxWidthClass="max-w-md"
                footer={
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
                            onClick={() => handleCheckOut(checkoutGuest.id)}
                            className="flex-1 al-btn-danger"
                        >
                            Confirm checkout
                        </button>
                    </div>
                }
            >
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                            <strong>{checkoutGuest.name || checkoutGuest.guestName || "Guest"}</strong>
                            {checkoutGuest.roomNumber ? ` · Room ${checkoutGuest.roomNumber}` : ""}
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
                                Add damages, minibar, late checkout, etc.
                            </p>
                        </div>

                        <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-700 dark:bg-navy-900 dark:text-gray-200">
                            <div className="flex items-center justify-between">
                                <span>Base amount</span>
                                <span className="font-medium">₹{Number(checkoutGuest.amount || 0) || 0}</span>
                            </div>
                            <div className="mt-1 flex items-center justify-between">
                                <span>Extra charges</span>
                                <span className="font-medium">₹{Number(checkoutExtraCharges || 0) || 0}</span>
                            </div>
                            <div className="mt-1 flex items-center justify-between">
                                <span>Total</span>
                                <span className="font-semibold">
                                    ₹{(Number(checkoutGuest.amount || 0) || 0) + (Number(checkoutExtraCharges || 0) || 0)}
                                </span>
                            </div>
                        </div>

            </Modal>
        </div>
    );
};

export default CheckinCheckout;
