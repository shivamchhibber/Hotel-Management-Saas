import React, { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../../../firebase/config";
import ComplexTable from "views/admin/default/components/ComplexTable";
import {
    MdEdit,
    MdCheckCircle,
    MdCancel,
    MdAdd
} from "react-icons/md";

function createdAtMs(data) {
    const c = data?.createdAt;
    if (!c) return 0;
    if (typeof c.toMillis === "function") return c.toMillis();
    if (typeof c.toDate === "function") return c.toDate().getTime();
    if (typeof c.seconds === "number") return c.seconds * 1000;
    if (c instanceof Date) return c.getTime();
    return 0;
}

const HotelManagement = () => {
    const [hotels, setHotels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedHotel, setSelectedHotel] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState("");

    const [ownerIdToUser, setOwnerIdToUser] = useState({});
    const [newHotel, setNewHotel] = useState({
        name: "",
        ownerName: "",
        ownerEmail: "",
        ownerPhone: "",
        address: "",
        phone: "",
        email: "",
    });

    useEffect(() => {
        fetchHotels();
        fetchOwners();
    }, []);

    const fetchOwners = async () => {
        try {
            const ownersQuery = query(collection(db, "users"), where("role", "==", "hotel_owner"));
            const snap = await getDocs(ownersQuery);
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            const map = {};
            list.forEach((u) => {
                map[u.id] = u;
                if (u.uid) map[u.uid] = u;
            });
            setOwnerIdToUser(map);
        } catch (e) {
            console.error("Error fetching owners:", e);
        }
    };

    const fetchHotels = async () => {
        try {
            setLoading(true);
            const hotelsSnapshot = await getDocs(collection(db, "hotels"));
            const hotelsData = hotelsSnapshot.docs
                .map((d) => ({ id: d.id, ...d.data() }))
                .sort((a, b) => createdAtMs(b) - createdAtMs(a));
            setHotels(hotelsData);
        } catch (error) {
            console.error("Error fetching hotels:", error);
        } finally {
            setLoading(false);
        }
    };

    const toggleHotelStatus = async (hotelId, currentStatus) => {
        try {
            const hotelRef = doc(db, "hotels", hotelId);
            await updateDoc(hotelRef, {
                isActive: !currentStatus,
                updatedAt: new Date()
            });
            setHotels(hotels.map(hotel => hotel.id === hotelId ? { ...hotel, isActive: !currentStatus } : hotel));
        } catch (error) {
            console.error("Error updating hotel status:", error);
        }
    };

    const saveNewHotel = async () => {
        if (!newHotel.name || !newHotel.ownerEmail) return;
        setSaving(true);
        setSaveError("");
        try {
            const t = (v) => (typeof v === "string" ? v : "").trim();
            const superAdminCreateHotel = httpsCallable(functions, "superAdminCreateHotel");
            await superAdminCreateHotel({
                ownerEmail: t(newHotel.ownerEmail),
                hotel: {
                    name: t(newHotel.name),
                    ownerName: t(newHotel.ownerName),
                    ownerPhone: t(newHotel.ownerPhone),
                    address: t(newHotel.address),
                    phone: t(newHotel.phone),
                    email: t(newHotel.email),
                    isActive: true,
                    amenities: [],
                    totalRooms: 0,
                    availableRooms: 0,
                    totalRevenue: 0,
                },
            });
            setShowModal(false);
            setNewHotel({ name: "", ownerName: "", ownerEmail: "", ownerPhone: "", address: "", phone: "", email: "" });
            await fetchHotels();
            await fetchOwners();
        } catch (e) {
            const code = String(e?.code || "");
            const msg = String(e?.message || e || "");
            const details = e?.details != null ? String(e.details) : "";
            const combined = [code && code !== "unknown" ? code : "", msg, details]
                .filter(Boolean)
                .join(" — ");
            const display =
                code === "functions/internal" || msg === "internal"
                    ? `Callable failed (${combined || "functions/internal"}). Deploy latest functions (firebase deploy --only functions), then check Functions → Logs for superAdminCreateHotel. Common causes: owner email not in Authentication, or an error during Firestore write.`
                    : combined || msg;
            setSaveError(display);
            console.error("Error saving hotel:", e);
        } finally {
            setSaving(false);
        }
    };

    const hotelColumns = [
        { Header: "Hotel Name", accessor: "name" },
        { Header: "Owner", accessor: "ownerDisplay" },
        { Header: "Address", accessor: "address" },
        { Header: "Phone", accessor: "phone" },
        { Header: "Email", accessor: "email" },
        { Header: "Active", accessor: "status" },
        { Header: "Created At", accessor: "createdAtFormatted" },
        { Header: "Actions", accessor: "actions" },
    ];

    const formatData = (hotels) => {
        return hotels.map(hotel => ({
            ...hotel,
            ownerDisplay: ownerIdToUser[hotel.ownerId]?.displayName || ownerIdToUser[hotel.ownerId]?.email || hotel.ownerId,
            createdAtFormatted: hotel.createdAt && typeof hotel.createdAt.toDate === 'function'
                ? hotel.createdAt.toDate().toLocaleString()
                : (hotel.createdAt ? new Date(hotel.createdAt).toLocaleString() : ''),
            status: (
                <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${hotel.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {hotel.isActive ? 'Active' : 'Inactive'}
                    </span>
                </div>
            ),
            actions: (
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => toggleHotelStatus(hotel.id, hotel.isActive)}
                        className={`p-2 rounded-lg ${hotel.isActive ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}
                        title={hotel.isActive ? 'Deactivate Hotel' : 'Activate Hotel'}
                    >
                        {hotel.isActive ? <MdCancel className="h-4 w-4" /> : <MdCheckCircle className="h-4 w-4" />}
                    </button>
                    <button
                        onClick={() => { setSelectedHotel(hotel); setShowModal(true); }}
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
            <div className="mt-6 mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-navy-700 dark:text-white">Hotel Management</h2>
                <button onClick={() => { setSelectedHotel(null); setSaveError(""); setShowModal(true); }} className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-white hover:bg-brand-600">
                    <MdAdd className="h-4 w-4" />
                    Add Hotel
                </button>
            </div>

            <ComplexTable columnsData={hotelColumns} tableData={formatData(hotels)} title="Hotels" />

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="w-full max-w-md rounded-lg bg-white p-6 dark:bg-navy-800">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-xl font-bold text-navy-700 dark:text-white">{selectedHotel ? 'Hotel Details' : 'Add Hotel'}</h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700"><MdCancel className="h-6 w-6" /></button>
                        </div>

                        <div className="space-y-4">
                            {selectedHotel ? (
                                <>
                                    <div>
                                        <label className="text-sm font-medium text-gray-600">Hotel Name</label>
                                        <p className="text-lg font-semibold text-navy-700 dark:text-white">{selectedHotel.name}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-600">Owner</label>
                                        <p className="text-navy-700 dark:text-white">{ownerIdToUser[selectedHotel.ownerId]?.displayName || ownerIdToUser[selectedHotel.ownerId]?.email || selectedHotel.ownerId}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-600">Address</label>
                                        <p className="text-navy-700 dark:text-white">{selectedHotel.address}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-600">Phone</label>
                                        <p className="text-navy-700 dark:text-white">{selectedHotel.phone}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-600">Email</label>
                                        <p className="text-navy-700 dark:text-white">{selectedHotel.email}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-600">Status</label>
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${selectedHotel.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{selectedHotel.isActive ? 'Active' : 'Inactive'}</span>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <p className="text-sm text-gray-600 dark:text-gray-300">
                                        The owner must already have signed up in Firebase Authentication with this email.
                                    </p>
                                    {saveError && (
                                        <div className="rounded-lg bg-red-50 p-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-200">{saveError}</div>
                                    )}
                                    <div>
                                        <label className="text-sm font-medium text-gray-600">Hotel Name</label>
                                        <input value={newHotel.name} onChange={(e) => setNewHotel({ ...newHotel, name: e.target.value })} className="mt-1 w-full rounded-md border p-2 dark:bg-navy-900 dark:text-white" placeholder="Hotel Name" />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-600">Owner Name</label>
                                        <input value={newHotel.ownerName} onChange={(e) => setNewHotel({ ...newHotel, ownerName: e.target.value })} className="mt-1 w-full rounded-md border p-2 dark:bg-navy-900 dark:text-white" placeholder="Owner full name" />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-600">Owner Email</label>
                                        <input type="email" value={newHotel.ownerEmail} onChange={(e) => setNewHotel({ ...newHotel, ownerEmail: e.target.value })} className="mt-1 w-full rounded-md border p-2 dark:bg-navy-900 dark:text-white" placeholder="owner@example.com" />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-600">Owner Phone</label>
                                        <input value={newHotel.ownerPhone} onChange={(e) => setNewHotel({ ...newHotel, ownerPhone: e.target.value })} className="mt-1 w-full rounded-md border p-2 dark:bg-navy-900 dark:text-white" placeholder="+91..." />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-600">Address</label>
                                        <input value={newHotel.address} onChange={(e) => setNewHotel({ ...newHotel, address: e.target.value })} className="mt-1 w-full rounded-md border p-2 dark:bg-navy-900 dark:text-white" placeholder="Address" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-sm font-medium text-gray-600">Phone</label>
                                            <input value={newHotel.phone} onChange={(e) => setNewHotel({ ...newHotel, phone: e.target.value })} className="mt-1 w-full rounded-md border p-2 dark:bg-navy-900 dark:text-white" placeholder="Phone" />
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-gray-600">Email</label>
                                            <input value={newHotel.email} onChange={(e) => setNewHotel({ ...newHotel, email: e.target.value })} className="mt-1 w-full rounded-md border p-2 dark:bg-navy-900 dark:text-white" placeholder="Email" />
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="mt-6 flex gap-3">
                            <button onClick={() => setShowModal(false)} className="flex-1 rounded-lg bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300">Close</button>
                            {selectedHotel ? (
                                <button onClick={() => { toggleHotelStatus(selectedHotel.id, selectedHotel.isActive); setShowModal(false); }} className={`flex-1 rounded-lg px-4 py-2 text-white ${selectedHotel.isActive ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}>{selectedHotel.isActive ? 'Deactivate' : 'Activate'}</button>
                            ) : (
                                <button type="button" onClick={saveNewHotel} disabled={saving} className="flex-1 rounded-lg bg-brand-500 px-4 py-2 text-white hover:bg-brand-600 disabled:opacity-50">{saving ? 'Saving…' : 'Save Hotel'}</button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HotelManagement;
