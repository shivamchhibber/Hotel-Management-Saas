import React, { useState, useEffect } from "react";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "../../../firebase/config";
import { useAuth } from "contexts/AuthContext";
import CheckTable from "views/admin/default/components/CheckTable";
import {
    MdHotel,
    MdCalendarToday,
    MdAttachMoney,
    MdRoom,
    MdCheckCircle,
    MdCancel,
    MdSearch
} from "react-icons/md";

const MyStays = () => {
    const { currentUser } = useAuth();
    const [stays, setStays] = useState([]);
    const [filteredStays, setFilteredStays] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");

    useEffect(() => {
        if (currentUser) {
            fetchStays();
        }
    }, [currentUser]);

    useEffect(() => {
        filterStays();
    }, [stays, searchTerm, filterStatus]);

    const fetchStays = async () => {
        try {
            setLoading(true);

            // Fetch check-ins for this guest
            const checkInsQuery = query(
                collection(db, "checkins"),
                where("guestId", "==", currentUser.uid),
                orderBy("checkInDate", "desc")
            );
            const checkInsSnapshot = await getDocs(checkInsQuery);
            const checkIns = checkInsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Fetch check-outs for this guest
            const checkOutsQuery = query(
                collection(db, "checkouts"),
                where("guestId", "==", currentUser.uid),
                orderBy("checkOutDate", "desc")
            );
            const checkOutsSnapshot = await getDocs(checkOutsQuery);
            const checkOuts = checkOutsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Combine check-ins and check-outs to create stay records
            const stayRecords = checkIns.map(checkIn => {
                const checkOut = checkOuts.find(co => co.guestId === checkIn.guestId);
                return {
                    id: checkIn.id,
                    hotelName: checkIn.hotelName || 'Hotel',
                    roomNumber: checkIn.roomNumber,
                    checkInDate: checkIn.checkInDate,
                    checkOutDate: checkOut?.checkOutDate || null,
                    amount: checkIn.amount,
                    isCheckedOut: !!checkOut,
                    checkOutId: checkOut?.id
                };
            });

            setStays(stayRecords);
        } catch (error) {
            console.error("Error fetching stays:", error);
        } finally {
            setLoading(false);
        }
    };

    const filterStays = () => {
        let filtered = stays;

        // Filter by search term
        if (searchTerm) {
            filtered = filtered.filter(stay =>
                stay.hotelName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                stay.roomNumber?.includes(searchTerm)
            );
        }

        // Filter by status
        if (filterStatus !== "all") {
            filtered = filtered.filter(stay => {
                if (filterStatus === "current") {
                    return !stay.isCheckedOut;
                } else if (filterStatus === "completed") {
                    return stay.isCheckedOut;
                }
                return true;
            });
        }

        setFilteredStays(filtered);
    };

    const getStatusColor = (isCheckedOut) => {
        return isCheckedOut
            ? 'bg-green-100 text-green-800'
            : 'bg-blue-100 text-blue-800';
    };

    const getStatusText = (isCheckedOut) => {
        return isCheckedOut ? 'Completed' : 'Current Stay';
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

    const stayColumns = [
        { Header: "Hotel", accessor: "hotelName" },
        { Header: "Room", accessor: "roomNumber" },
        { Header: "Check-in Date", accessor: "checkInDate" },
        { Header: "Check-out Date", accessor: "checkOutDate" },
        { Header: "Amount", accessor: "amount" },
        { Header: "Status", accessor: "status" },
    ];

    const formatData = (stays) => {
        return stays.map(stay => ({
            ...stay,
            checkInDate: formatDate(stay.checkInDate),
            checkOutDate: formatDate(stay.checkOutDate),
            amount: formatCurrency(stay.amount || 0),
            status: (
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(stay.isCheckedOut)}`}>
                    {getStatusText(stay.isCheckedOut)}
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
                    My Stays
                </h2>
            </div>

            {/* Search and Filter */}
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="relative flex-1">
                    <MdSearch className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search stays..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-gray-700 focus:border-brand-500 focus:outline-none dark:border-gray-600 dark:bg-navy-800 dark:text-white"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-700 focus:border-brand-500 focus:outline-none dark:border-gray-600 dark:bg-navy-800 dark:text-white"
                    >
                        <option value="all">All Stays</option>
                        <option value="current">Current Stays</option>
                        <option value="completed">Completed Stays</option>
                    </select>
                </div>
            </div>

            {/* Stats */}
            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-navy-800">
                    <h3 className="text-sm font-medium text-gray-600">Total Stays</h3>
                    <p className="text-2xl font-bold text-navy-700 dark:text-white">{stays.length}</p>
                </div>
                <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-navy-800">
                    <h3 className="text-sm font-medium text-gray-600">Current Stays</h3>
                    <p className="text-2xl font-bold text-blue-600">
                        {stays.filter(stay => !stay.isCheckedOut).length}
                    </p>
                </div>
                <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-navy-800">
                    <h3 className="text-sm font-medium text-gray-600">Completed Stays</h3>
                    <p className="text-2xl font-bold text-green-600">
                        {stays.filter(stay => stay.isCheckedOut).length}
                    </p>
                </div>
            </div>

            {/* Stay Cards */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredStays.map((stay) => (
                    <div key={stay.id} className="rounded-lg bg-white p-6 shadow-sm dark:bg-navy-800">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-navy-700 dark:text-white">
                                {stay.hotelName}
                            </h3>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(stay.isCheckedOut)}`}>
                                {getStatusText(stay.isCheckedOut)}
                            </span>
                        </div>

                        <div className="space-y-2 text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                                <MdRoom className="h-4 w-4" />
                                <span>Room {stay.roomNumber}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <MdCalendarToday className="h-4 w-4" />
                                <span>Check-in: {formatDate(stay.checkInDate)}</span>
                            </div>
                            {stay.checkOutDate && (
                                <div className="flex items-center gap-2">
                                    <MdCalendarToday className="h-4 w-4" />
                                    <span>Check-out: {formatDate(stay.checkOutDate)}</span>
                                </div>
                            )}
                            <div className="flex items-center gap-2">
                                <MdAttachMoney className="h-4 w-4" />
                                <span>{formatCurrency(stay.amount || 0)}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {filteredStays.length === 0 && (
                <div className="text-center py-12">
                    <MdHotel className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No stays found</h3>
                    <p className="mt-1 text-sm text-gray-500">
                        {searchTerm || filterStatus !== "all"
                            ? "Try adjusting your search or filter criteria."
                            : "You haven't made any hotel bookings yet."
                        }
                    </p>
                </div>
            )}
        </div>
    );
};

export default MyStays;
