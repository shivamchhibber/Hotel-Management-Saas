import React, { useState, useEffect } from "react";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "../../../firebase/config";
import { useAuth } from "contexts/AuthContext";
import { resolveHotelIdForOwner } from "utils/hotelOwnerUtils";
import WeeklyRevenue from "views/admin/default/components/WeeklyRevenue";
import TotalSpent from "views/admin/default/components/TotalSpent";
import PieChartCard from "views/admin/default/components/PieChartCard";
import DailyTraffic from "views/admin/default/components/DailyTraffic";
import {
    MdTrendingUp,
    MdAttachMoney,
    MdPeople,
    MdCalendarToday,
    MdDownload
} from "react-icons/md";

const Reports = () => {
    const { currentUser } = useAuth();
    const [reports, setReports] = useState({
        totalRevenue: 0,
        totalGuests: 0,
        averageStayDuration: 0,
        occupancyRate: 0
    });
    const [revenueData, setRevenueData] = useState([]);
    const [guestData, setGuestData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [missingHotel, setMissingHotel] = useState(false);
    const [dateRange, setDateRange] = useState("30"); // days

    useEffect(() => {
        if (currentUser) {
            fetchReportsData();
        }
    }, [currentUser, dateRange]);

    const fetchReportsData = async () => {
        try {
            setLoading(true);

            const hotelId = await resolveHotelIdForOwner(currentUser.uid);

            if (!hotelId) {
                setMissingHotel(true);
                setReports({
                    totalRevenue: 0,
                    totalGuests: 0,
                    averageStayDuration: 0,
                    occupancyRate: 0,
                });
                setRevenueData([]);
                setGuestData([]);
                return;
            }
            setMissingHotel(false);

            // Calculate date range
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - parseInt(dateRange));

            // Fetch check-ins for revenue calculation
            const checkInsQuery = query(
                collection(db, "checkins"),
                where("hotelId", "==", hotelId),
                where("checkInDate", ">=", startDate),
                where("checkInDate", "<=", endDate),
                orderBy("checkInDate", "asc")
            );
            const checkInsSnapshot = await getDocs(checkInsQuery);
            const checkIns = checkInsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Fetch check-outs for guest data
            const checkOutsQuery = query(
                collection(db, "checkouts"),
                where("hotelId", "==", hotelId),
                where("checkOutDate", ">=", startDate),
                where("checkOutDate", "<=", endDate),
                orderBy("checkOutDate", "asc")
            );
            const checkOutsSnapshot = await getDocs(checkOutsQuery);
            const checkOuts = checkOutsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Calculate metrics
            const totalRevenue = checkIns.reduce((sum, checkin) => sum + (checkin.amount || 0), 0);
            const totalGuests = checkIns.length;

            // Calculate average stay duration
            const stayDurations = checkOuts.map(checkout => {
                const checkIn = checkIns.find(ci => ci.guestId === checkout.guestId);
                if (checkIn) {
                    const checkInDate = checkIn.checkInDate?.toDate();
                    const checkOutDate = checkout.checkOutDate?.toDate();
                    if (checkInDate && checkOutDate) {
                        return Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
                    }
                }
                return 0;
            }).filter(duration => duration > 0);

            const averageStayDuration = stayDurations.length > 0
                ? Math.round(stayDurations.reduce((sum, duration) => sum + duration, 0) / stayDurations.length)
                : 0;

            // Calculate occupancy rate (assuming 50 rooms max)
            const maxRooms = 50;
            const occupancyRate = Math.round((totalGuests / (maxRooms * parseInt(dateRange))) * 100);

            setReports({
                totalRevenue,
                totalGuests,
                averageStayDuration,
                occupancyRate
            });

            // Prepare chart data
            prepareChartData(checkIns, checkOuts);
        } catch (error) {
            console.error("Error fetching reports data:", error);
        } finally {
            setLoading(false);
        }
    };

    const prepareChartData = (checkIns, checkOuts) => {
        // Revenue data by day
        const revenueByDay = {};
        checkIns.forEach(checkin => {
            const date = checkin.checkInDate?.toDate();
            if (date) {
                const dateStr = date.toISOString().split('T')[0];
                revenueByDay[dateStr] = (revenueByDay[dateStr] || 0) + (checkin.amount || 0);
            }
        });

        const revenueData = Object.entries(revenueByDay).map(([date, amount]) => ({
            date,
            amount
        }));

        // Guest data by day
        const guestsByDay = {};
        checkIns.forEach(checkin => {
            const date = checkin.checkInDate?.toDate();
            if (date) {
                const dateStr = date.toISOString().split('T')[0];
                guestsByDay[dateStr] = (guestsByDay[dateStr] || 0) + 1;
            }
        });

        const guestData = Object.entries(guestsByDay).map(([date, count]) => ({
            date,
            count
        }));

        setRevenueData(revenueData);
        setGuestData(guestData);
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(amount);
    };

    const exportReport = () => {
        // Simple CSV export functionality
        const csvData = [
            ['Metric', 'Value'],
            ['Total Revenue', formatCurrency(reports.totalRevenue)],
            ['Total Guests', reports.totalGuests.toString()],
            ['Average Stay Duration', `${reports.averageStayDuration} days`],
            ['Occupancy Rate', `${reports.occupancyRate}%`]
        ];

        const csvContent = csvData.map(row => row.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `hotel-report-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
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
            {missingHotel && (
                <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                    <p className="font-semibold">No hotel linked to your account</p>
                    <p className="mt-1 text-sm">
                        Ask a super admin to assign your hotel via Hotel Management (your sign-up email), or fix{" "}
                        <code className="rounded bg-white/60 px-1 dark:bg-black/30">hotels.ownerId</code> to your Auth UID.
                    </p>
                </div>
            )}
            <div className="mt-6 mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-navy-700 dark:text-white">
                    Reports & Analytics
                </h2>
                <div className="flex items-center gap-4">
                    <select
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-700 focus:border-brand-500 focus:outline-none dark:border-gray-600 dark:bg-navy-800 dark:text-white"
                    >
                        <option value="7">Last 7 days</option>
                        <option value="30">Last 30 days</option>
                        <option value="90">Last 90 days</option>
                    </select>
                    <button
                        onClick={exportReport}
                        className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-white hover:bg-brand-600"
                    >
                        <MdDownload className="h-4 w-4" />
                        Export Report
                    </button>
                </div>
            </div>

            {/* Key Metrics */}
            <div className="mb-6 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-navy-800">
                    <div className="flex items-center">
                        <div className="rounded-full bg-brand-100 p-3">
                            <MdAttachMoney className="h-6 w-6 text-brand-600" />
                        </div>
                        <div className="ml-4">
                            <h3 className="text-sm font-medium text-gray-600">Total Revenue</h3>
                            <p className="text-2xl font-bold text-navy-700 dark:text-white">
                                {formatCurrency(reports.totalRevenue)}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-navy-800">
                    <div className="flex items-center">
                        <div className="rounded-full bg-green-100 p-3">
                            <MdPeople className="h-6 w-6 text-green-600" />
                        </div>
                        <div className="ml-4">
                            <h3 className="text-sm font-medium text-gray-600">Total Guests</h3>
                            <p className="text-2xl font-bold text-navy-700 dark:text-white">
                                {reports.totalGuests}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-navy-800">
                    <div className="flex items-center">
                        <div className="rounded-full bg-blue-100 p-3">
                            <MdCalendarToday className="h-6 w-6 text-blue-600" />
                        </div>
                        <div className="ml-4">
                            <h3 className="text-sm font-medium text-gray-600">Avg Stay Duration</h3>
                            <p className="text-2xl font-bold text-navy-700 dark:text-white">
                                {reports.averageStayDuration} days
                            </p>
                        </div>
                    </div>
                </div>

                <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-navy-800">
                    <div className="flex items-center">
                        <div className="rounded-full bg-purple-100 p-3">
                            <MdTrendingUp className="h-6 w-6 text-purple-600" />
                        </div>
                        <div className="ml-4">
                            <h3 className="text-sm font-medium text-gray-600">Occupancy Rate</h3>
                            <p className="text-2xl font-bold text-navy-700 dark:text-white">
                                {reports.occupancyRate}%
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <TotalSpent />
                <WeeklyRevenue />
            </div>

            <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
                <DailyTraffic />
                <PieChartCard />
            </div>
        </div>
    );
};

export default Reports;
