import React, { useState, useEffect } from "react";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "../../../firebase/config";
import { useAuth } from "contexts/AuthContext";
import { getHotelIdFromUserProfile } from "utils/userProfileUtils";
import { staffListGuestsFn } from "utils/staffCallables";
import CheckTable from "views/admin/default/components/CheckTable";
import {
    MdPeople,
    MdSearch,
    MdFilterList,
    MdCheckCircle,
    MdCancel
} from "react-icons/md";

const GuestList = () => {
    const { currentUser } = useAuth();
    const [guests, setGuests] = useState([]);
    const [filteredGuests, setFilteredGuests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");

    useEffect(() => {
        if (currentUser) {
            fetchGuests();
        }
    }, [currentUser]);

    useEffect(() => {
        filterGuests();
    }, [guests, searchTerm, filterStatus]);

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

    const filterGuests = () => {
        let filtered = guests;

        // Filter by search term
        if (searchTerm) {
            filtered = filtered.filter(guest =>
                guest.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                guest.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                guest.phoneNumber?.includes(searchTerm) ||
                guest.roomNumber?.includes(searchTerm)
            );
        }

        // Filter by status
        if (filterStatus !== "all") {
            filtered = filtered.filter(guest => {
                if (filterStatus === "checked_in") {
                    return guest.isCheckedIn;
                } else if (filterStatus === "checked_out") {
                    return !guest.isCheckedIn;
                }
                return true;
            });
        }

        setFilteredGuests(filtered);
    };

    const getStatusColor = (isCheckedIn) => {
        return isCheckedIn
            ? 'bg-green-100 text-green-800'
            : 'bg-gray-100 text-gray-800';
    };

    const getStatusText = (isCheckedIn) => {
        return isCheckedIn ? 'Checked In' : 'Checked Out';
    };

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

    const guestColumns = [
        { Header: "Name", accessor: "name" },
        { Header: "Email", accessor: "email" },
        { Header: "Phone", accessor: "phoneNumber" },
        { Header: "Room", accessor: "roomNumber" },
        { Header: "Check-in Date", accessor: "checkInDate" },
        { Header: "Check-out Date", accessor: "checkOutDate" },
        { Header: "Amount", accessor: "amount" },
        { Header: "Status", accessor: "status" },
    ];

    const formatData = (guests) => {
        return guests.map(guest => ({
            ...guest,
            name: guest.name || guest.guestName || "—",
            email: guest.email || guest.guestEmail || "—",
            phoneNumber: guest.phoneNumber || guest.guestPhone || "—",
            checkInDate: formatDate(guest.checkInDate),
            checkOutDate: formatDate(guest.checkOutDate),
            amount: formatCurrency(guest.amount || 0),
            status: (
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(guest.isCheckedIn)}`}>
                    {getStatusText(guest.isCheckedIn)}
                </span>
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
                    Guest List
                </h2>
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
            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-navy-800">
                    <h3 className="text-sm font-medium text-gray-600">Total Guests</h3>
                    <p className="text-2xl font-bold text-navy-700 dark:text-white">{guests.length}</p>
                </div>
                <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-navy-800">
                    <h3 className="text-sm font-medium text-gray-600">Checked In</h3>
                    <p className="text-2xl font-bold text-green-600">
                        {guests.filter(guest => guest.isCheckedIn).length}
                    </p>
                </div>
                <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-navy-800">
                    <h3 className="text-sm font-medium text-gray-600">Checked Out</h3>
                    <p className="text-2xl font-bold text-gray-600">
                        {guests.filter(guest => !guest.isCheckedIn).length}
                    </p>
                </div>
            </div>

            <CheckTable
                columnsData={guestColumns}
                tableData={formatData(filteredGuests)}
            />
        </div>
    );
};

export default GuestList;
