import React, { useState, useEffect, useCallback } from "react";
import { collection, getDocs, query, where, doc, updateDoc } from "firebase/firestore";
import { db } from "../../../firebase/config";
import { useAuth } from "contexts/AuthContext";
import { resolveHotelIdForOwner } from "utils/hotelOwnerUtils";
import { ownerListRoomsFn, ownerListGuestsFn, ownerListStaysFn } from "utils/ownerCallables";
import { mergeOwnerGuestView } from "utils/ownerGuestMerge";
import ComplexTable from "views/admin/default/components/ComplexTable";
import {
    MdSearch,
    MdFilterList,
    MdInfo,
    MdClose
} from "react-icons/md";
import { idDocumentTypeLabel } from "utils/idDocuments";

const GuestManagement = () => {
    const { currentUser } = useAuth();
    const [guests, setGuests] = useState([]);
    const [filteredGuests, setFilteredGuests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");
    const [showGuestDetails, setShowGuestDetails] = useState(false);
    const [selectedGuest, setSelectedGuest] = useState(null);

    const printSelectedGuest = () => {
        if (!selectedGuest) return;
        const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
        if (!w) return;
        const staysHtml = (selectedGuest.stays || [])
            .map((s, idx) => {
                const idLine = s.idDocumentType
                    ? `${idDocumentTypeLabel(s.idDocumentType)}${s.idProof ? ` · ${s.idProof}` : ""}`
                    : s.idProof || "";
                const amountLine =
                    s.amount != null
                        ? `Amount: ₹${s.amount}${s.additionalCharges ? ` (Additional: ₹${s.additionalCharges})` : ""}`
                        : "";
                return `
                  <tr>
                    <td style="padding:8px;border:1px solid #ddd;">${idx + 1}</td>
                    <td style="padding:8px;border:1px solid #ddd;">${s.roomNumber || ""}</td>
                    <td style="padding:8px;border:1px solid #ddd;">${s.roomStatus || ""}</td>
                    <td style="padding:8px;border:1px solid #ddd;">${s.checkedInAt ? new Date(s.checkedInAt.toDate ? s.checkedInAt.toDate() : s.checkedInAt).toLocaleString() : ""}</td>
                    <td style="padding:8px;border:1px solid #ddd;">${s.checkOutDate ? new Date(s.checkOutDate.toDate ? s.checkOutDate.toDate() : s.checkOutDate).toLocaleString() : ""}</td>
                    <td style="padding:8px;border:1px solid #ddd;">${idLine}</td>
                    <td style="padding:8px;border:1px solid #ddd;">${amountLine}</td>
                  </tr>`;
            })
            .join("");
        w.document.write(`
          <html>
            <head>
              <title>Guest Check-in Details</title>
              <meta name="viewport" content="width=device-width, initial-scale=1" />
            </head>
            <body style="font-family: system-ui, -apple-system, Segoe UI, sans-serif; padding: 20px;">
              <h2 style="margin:0 0 6px;">Guest Check-in Details</h2>
              <div style="margin:0 0 16px;color:#444;">
                <div><strong>Name:</strong> ${selectedGuest.guestName || ""}</div>
                <div><strong>Email:</strong> ${selectedGuest.guestEmail || ""}</div>
                <div><strong>Phone:</strong> ${selectedGuest.guestPhone || ""}</div>
              </div>
              <table style="border-collapse:collapse;width:100%;font-size:12px;">
                <thead>
                  <tr>
                    <th style="text-align:left;padding:8px;border:1px solid #ddd;">#</th>
                    <th style="text-align:left;padding:8px;border:1px solid #ddd;">Room</th>
                    <th style="text-align:left;padding:8px;border:1px solid #ddd;">Status</th>
                    <th style="text-align:left;padding:8px;border:1px solid #ddd;">Check-in</th>
                    <th style="text-align:left;padding:8px;border:1px solid #ddd;">Check-out</th>
                    <th style="text-align:left;padding:8px;border:1px solid #ddd;">ID</th>
                    <th style="text-align:left;padding:8px;border:1px solid #ddd;">Payment</th>
                  </tr>
                </thead>
                <tbody>${staysHtml}</tbody>
              </table>
              <script>
                setTimeout(() => { window.print(); }, 250);
              </script>
            </body>
          </html>
        `);
        w.document.close();
    };

    const fetchGuests = useCallback(async () => {
        try {
            setLoading(true);

            let roomsData = [];
            let ledgerGuests = [];
            let staysData = [];

            try {
                const [roomsRes, guestsRes, staysRes] = await Promise.all([
                    ownerListRoomsFn({}),
                    ownerListGuestsFn({}),
                    ownerListStaysFn({}),
                ]);
                roomsData = Array.isArray(roomsRes.data?.rooms) ? roomsRes.data.rooms : [];
                ledgerGuests = Array.isArray(guestsRes.data?.guests) ? guestsRes.data.guests : [];
                staysData = Array.isArray(staysRes.data?.stays) ? staysRes.data.stays : [];
            } catch (callableErr) {
                console.warn("ownerListRooms / ownerListGuests failed; falling back to Firestore:", callableErr);
                const hotelId = await resolveHotelIdForOwner(currentUser.uid);
                if (!hotelId) {
                    console.error("No hotel ID found for owner");
                    setGuests([]);
                    setFilteredGuests([]);
                    return;
                }
                const roomsQuery = query(collection(db, "rooms"), where("hotelId", "==", hotelId));
                const roomsSnapshot = await getDocs(roomsQuery);
                roomsData = roomsSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
                const guestsQuery = query(collection(db, "guests"), where("hotelId", "==", hotelId));
                const guestsSnapshot = await getDocs(guestsQuery);
                ledgerGuests = guestsSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            }

            const guestsData = mergeOwnerGuestView(roomsData, ledgerGuests, staysData);
            setGuests(guestsData);
        } catch (error) {
            console.error("Error fetching guests:", error);
        } finally {
            setLoading(false);
        }
    }, [currentUser]);

    const filterGuests = useCallback(() => {
        let filtered = guests;

        // Filter by search term
        if (searchTerm) {
            filtered = filtered.filter(guest =>
                guest.guestName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                guest.guestEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                guest.guestPhone?.includes(searchTerm) ||
                guest.currentRoom?.includes(searchTerm)
            );
        }

        // Filter by status
        if (filterStatus !== "all") {
            filtered = filtered.filter(guest => {
                if (filterStatus === "checked_in") {
                    return guest.isCurrentlyCheckedIn;
                } else if (filterStatus === "checked_out") {
                    return !guest.isCurrentlyCheckedIn;
                }
                return true;
            });
        }

        setFilteredGuests(filtered);
    }, [guests, searchTerm, filterStatus]);

    useEffect(() => {
        if (currentUser) {
            fetchGuests();
        }
    }, [currentUser, fetchGuests]);

    useEffect(() => {
        filterGuests();
    }, [filterGuests]);

    const getStatusColor = (isCheckedIn) => {
        return isCheckedIn
            ? 'bg-green-100 text-green-800'
            : 'bg-gray-100 text-gray-800';
    };

    const getStatusText = (isCheckedIn) => {
        return isCheckedIn ? 'Currently Checked In' : 'Checked Out';
    };

    const handleShowGuestDetails = (guest) => {
        setSelectedGuest(guest);
        setShowGuestDetails(true);
    };

    const addTestGuestData = async () => {
        try {
            const hotelId = await resolveHotelIdForOwner(currentUser.uid);

            if (!hotelId) {
                console.error("No hotel ID found for owner");
                return;
            }

            // Get the first available room to add test guest data
            const roomsQuery = query(
                collection(db, "rooms"),
                where("hotelId", "==", hotelId)
            );
            const roomsSnapshot = await getDocs(roomsQuery);
            const roomsData = roomsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            if (roomsData.length === 0) {
                console.error("No rooms found to add test guest data");
                return;
            }

            // Use the first room to add test guest data
            const testRoom = roomsData[0];
            const testGuestInfo = {
                guestName: "John Doe",
                guestEmail: "john.doe@example.com",
                guestPhone: "+1234567890",
                guestId: "GUEST001",
                numberOfGuests: 2,
                checkInDate: new Date(),
                checkOutDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
                specialRequests: "Late checkout requested",
                checkedInAt: new Date(),
                checkedInBy: currentUser.uid
            };

            // Update the room with test guest data
            await updateDoc(doc(db, "rooms", testRoom.id), {
                guestInfo: testGuestInfo,
                status: "checked-in"
            });

            // Refresh the guests list
            fetchGuests();
        } catch (error) {
            console.error("Error adding test guest data:", error);
        }
    };

    const guestColumns = [
        { Header: "Name", accessor: "guestName" },
        { Header: "Email", accessor: "guestEmail" },
        { Header: "Phone", accessor: "guestPhone" },
        { Header: "Current Room", accessor: "currentRoom" },
        { Header: "Stay Count", accessor: "stayCount" },
        { Header: "Status", accessor: "status" },
        { Header: "Actions", accessor: "actions" },
    ];

    const formatData = (guests) => {
        return guests.map(guest => ({
            ...guest,
            stayCount: (
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                    {guest.stayCount} {guest.stayCount === 1 ? 'stay' : 'stays'}
                </span>
            ),
            status: (
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(guest.isCurrentlyCheckedIn)}`}>
                    {getStatusText(guest.isCurrentlyCheckedIn)}
                </span>
            ),
            actions: (
                <button
                    onClick={() => handleShowGuestDetails(guest)}
                    className="flex items-center gap-1 px-3 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    title="View guest details and stay history"
                >
                    <MdInfo className="h-4 w-4" />
                    Details
                </button>
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
                    Guest Management
                </h2>
                <button
                    onClick={addTestGuestData}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                    Add Test Guest Data
                </button>
            </div>

            {/* Search and Filter */}
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="relative flex-1">
                    <MdSearch className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search guests..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-gray-700 focus:border-brand-500 focus:outline-none dark:border-gray-600 dark:bg-navy-800 dark:text-white"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <MdFilterList className="h-5 w-5 text-gray-400" />
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-700 focus:border-brand-500 focus:outline-none dark:border-gray-600 dark:bg-navy-800 dark:text-white"
                    >
                        <option value="all">All Guests</option>
                        <option value="checked_in">Checked In</option>
                        <option value="checked_out">Checked Out</option>
                    </select>
                </div>
            </div>

            {/* Stats */}
            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-navy-800">
                    <h3 className="text-sm font-medium text-gray-600">Total Guests</h3>
                    <p className="text-2xl font-bold text-navy-700 dark:text-white">{guests.length}</p>
                </div>
                <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-navy-800">
                    <h3 className="text-sm font-medium text-gray-600">Currently Checked In</h3>
                    <p className="text-2xl font-bold text-green-600">
                        {guests.filter(guest => guest.isCurrentlyCheckedIn).length}
                    </p>
                </div>
                <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-navy-800">
                    <h3 className="text-sm font-medium text-gray-600">Total Stays</h3>
                    <p className="text-2xl font-bold text-blue-600">
                        {guests.reduce((total, guest) => total + guest.stayCount, 0)}
                    </p>
                </div>
                <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-navy-800">
                    <h3 className="text-sm font-medium text-gray-600">Repeat Guests</h3>
                    <p className="text-2xl font-bold text-purple-600">
                        {guests.filter(guest => guest.stayCount > 1).length}
                    </p>
                </div>
            </div>

            {filteredGuests.length > 0 ? (
            <ComplexTable
                columnsData={guestColumns}
                tableData={formatData(filteredGuests)}
            />
            ) : (
                <div className="bg-white dark:bg-navy-800 p-6 rounded-lg shadow text-center">
                    <p className="text-gray-500 dark:text-gray-400 mb-4">
                        No guest data found. Guest information will appear here when guests check in to rooms.
                    </p>
                    <button
                        onClick={addTestGuestData}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    >
                        Add Test Guest Data
                    </button>
                </div>
            )}

            {/* Guest Details Modal */}
            {showGuestDetails && selectedGuest && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-4">
                    <div className="min-h-full flex items-start justify-center py-6">
                        <div className="bg-white dark:bg-navy-800 p-6 rounded-2xl shadow-lg w-full max-w-4xl max-h-[85vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-semibold text-navy-700 dark:text-white">
                                Guest Details - {selectedGuest.guestName}
                            </h3>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={printSelectedGuest}
                                    className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600"
                                >
                                    Print
                                </button>
                                <button
                                    onClick={() => setShowGuestDetails(false)}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <MdClose className="h-6 w-6" />
                                </button>
                            </div>
                        </div>

                        {/* Guest Information */}
                        <div className="mb-6">
                            <h4 className="text-lg font-medium text-navy-700 dark:text-white mb-3">Guest Information</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Full Name
                                    </label>
                                    <p className="text-navy-700 dark:text-white">{selectedGuest.guestName}</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Email
                                    </label>
                                    <p className="text-navy-700 dark:text-white">{selectedGuest.guestEmail}</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Phone Number
                                    </label>
                                    <p className="text-navy-700 dark:text-white">{selectedGuest.guestPhone}</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Guest ID
                                    </label>
                                    <p className="text-navy-700 dark:text-white">{selectedGuest.guestId || 'N/A'}</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Number of Guests
                                    </label>
                                    <p className="text-navy-700 dark:text-white">{selectedGuest.numberOfGuests ?? "—"}</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Total Stays
                                    </label>
                                    <p className="text-navy-700 dark:text-white">{selectedGuest.stayCount}</p>
                                </div>
                            </div>
                        </div>

                        {/* Stay History */}
                        <div>
                            <h4 className="text-lg font-medium text-navy-700 dark:text-white mb-3">Stay History</h4>
                            <div className="space-y-4">
                                {selectedGuest.stays.map((stay, index) => (
                                    <div key={index} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <h5 className="font-medium text-navy-700 dark:text-white">
                                                Stay #{index + 1} - Room {stay.roomNumber}
                                            </h5>
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                stay.roomStatus === 'checked-in' || stay.roomStatus === 'occupied' 
                                                    ? 'bg-green-100 text-green-800' 
                                                    : 'bg-gray-100 text-gray-800'
                                            }`}>
                                                {stay.roomStatus}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <label className="block text-gray-600 dark:text-gray-400 mb-1">Check-in Date</label>
                                                <p className="text-navy-700 dark:text-white">
                                                    {stay.checkInDate ? 
                                                        (stay.checkInDate.toDate ? 
                                                            stay.checkInDate.toDate().toLocaleDateString() :
                                                            new Date(stay.checkInDate).toLocaleDateString()) : 
                                                        'N/A'}
                                                </p>
                                            </div>
                                            <div>
                                                <label className="block text-gray-600 dark:text-gray-400 mb-1">Check-out Date</label>
                                                <p className="text-navy-700 dark:text-white">
                                                    {stay.checkOutDate ? 
                                                        (stay.checkOutDate.toDate ? 
                                                            stay.checkOutDate.toDate().toLocaleDateString() :
                                                            new Date(stay.checkOutDate).toLocaleDateString()) : 
                                                        'N/A'}
                                                </p>
                                            </div>
                                            <div>
                                                <label className="block text-gray-600 dark:text-gray-400 mb-1">Checked in at</label>
                                                <p className="text-navy-700 dark:text-white">
                                                    {stay.checkedInAt ? 
                                                        (stay.checkedInAt.toDate ? 
                                                            stay.checkedInAt.toDate().toLocaleString() :
                                                            new Date(stay.checkedInAt).toLocaleString()) : 
                                                        'N/A'}
                                                </p>
                                            </div>
                                            <div>
                                                <label className="block text-gray-600 dark:text-gray-400 mb-1">Checked in by</label>
                                                <p className="text-navy-700 dark:text-white">{stay.checkedInBy || 'N/A'}</p>
                                            </div>
                                            {stay.specialRequests && (
                                                <div className="md:col-span-2">
                                                    <label className="block text-gray-600 dark:text-gray-400 mb-1">Special Requests</label>
                                                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                                                        <p className="text-blue-800 dark:text-blue-200 text-sm">
                                                            {stay.specialRequests}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                            {(stay.idProof || stay.idDocumentType) && (
                                                <div className="md:col-span-2">
                                                    <label className="block text-gray-600 dark:text-gray-400 mb-1">ID</label>
                                                    <p className="text-navy-700 dark:text-white text-sm">
                                                        {stay.idDocumentType
                                                            ? `${idDocumentTypeLabel(stay.idDocumentType)}${stay.idProof ? ` · ${stay.idProof}` : ""}`
                                                            : stay.idProof || "—"}
                                                    </p>
                                                </div>
                                            )}
                                            {Array.isArray(stay.idDocumentImages) && stay.idDocumentImages.length > 0 && (
                                                <div className="md:col-span-2">
                                                    <label className="block text-gray-600 dark:text-gray-400 mb-2">ID images</label>
                                                    <div className="flex flex-wrap gap-2">
                                                        {stay.idDocumentImages.map((im, ii) => (
                                                            <a
                                                                key={ii}
                                                                href={im.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="block h-28 w-28 overflow-hidden rounded-lg border border-gray-200 dark:border-navy-600"
                                                            >
                                                                <img
                                                                    src={im.url}
                                                                    alt=""
                                                                    className="h-full w-full object-cover"
                                                                />
                                                            </a>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <button
                                onClick={() => setShowGuestDetails(false)}
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GuestManagement;
