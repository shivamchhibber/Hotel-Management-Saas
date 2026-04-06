import React, { useState, useEffect, useCallback } from "react";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "../../../firebase/config";
import { useAuth } from "contexts/AuthContext";
import { resolveHotelIdForOwner } from "utils/hotelOwnerUtils";
import { ownerListStaysFn } from "utils/ownerCallables";
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
    const [loading, setLoading] = useState(true);
    const [missingHotel, setMissingHotel] = useState(false);
    const [dateRange, setDateRange] = useState("30"); // days
    const [dailyRevenue, setDailyRevenue] = useState([]); // [{dateLabel, total}]

    const fetchReportsData = useCallback(async () => {
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
                return;
            }
            setMissingHotel(false);

            // Calculate date range
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - parseInt(dateRange));

            let stays = [];
            try {
                const { data } = await ownerListStaysFn({});
                stays = Array.isArray(data?.stays) ? data.stays : [];
            } catch (callableErr) {
                console.warn("ownerListStays failed; falling back to Firestore query:", callableErr);
                const staysQuery = query(
                    collection(db, "stays"),
                    where("hotelId", "==", hotelId),
                    orderBy("checkInAt", "asc"),
                );
                const staysSnap = await getDocs(staysQuery);
                stays = staysSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
            }

            const inRange = stays.filter((s) => {
                const ci = s.checkInAt?.toDate ? s.checkInAt.toDate() : new Date(s.checkInAt);
                return ci >= startDate && ci <= endDate;
            });

            const completed = inRange.filter((s) => !!s.checkOutAt);
            const totalRevenue = completed.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);
            const totalGuests = inRange.length;

            const avgNights =
                completed.length > 0
                    ? Math.round(
                        completed.reduce((sum, s) => sum + Number(s.nights || 0), 0) / completed.length,
                    )
                    : 0;

            const maxRooms = 50;
            const occupancyRate = Math.round((totalGuests / (maxRooms * parseInt(dateRange))) * 100);

            setReports({
                totalRevenue,
                totalGuests,
                averageStayDuration: avgNights,
                occupancyRate
            });

            // Build daily revenue series from completed stays (by checkout date).
            const byDay = new Map();
            completed.forEach((s) => {
                const d = s.checkOutAt?.toDate ? s.checkOutAt.toDate() : new Date(s.checkOutAt);
                if (!(d instanceof Date) || Number.isNaN(d.getTime())) return;
                const key = d.toISOString().slice(0, 10);
                const prev = byDay.get(key) || 0;
                byDay.set(key, prev + Number(s.totalAmount || 0));
            });
            const series = Array.from(byDay.entries())
                .sort((a, b) => (a[0] < b[0] ? -1 : 1))
                .map(([iso, total]) => ({
                    iso,
                    dateLabel: new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
                    total,
                }));
            setDailyRevenue(series);
        } catch (error) {
            console.error("Error fetching reports data:", error);
        } finally {
            setLoading(false);
        }
    }, [currentUser, dateRange]);

    useEffect(() => {
        if (currentUser) {
            fetchReportsData();
        }
    }, [currentUser, fetchReportsData]);

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
            <div className="al-card">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Revenue trend</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Based on check-outs in selected range</p>
                    </div>
                </div>

                {dailyRevenue.length === 0 ? (
                    <div className="mt-4 rounded-2xl bg-gray-50 p-4 text-sm text-gray-600 dark:bg-navy-900 dark:text-gray-300">
                        No completed stays in this range yet.
                    </div>
                ) : (
                    <div className="mt-4 grid grid-cols-1 gap-3">
                        {(() => {
                            const max = Math.max(...dailyRevenue.map((x) => x.total || 0), 1);
                            return dailyRevenue.slice(-14).map((d) => (
                                <div key={d.iso} className="flex items-center gap-3">
                                    <div className="w-12 text-xs text-gray-500 dark:text-gray-400">{d.dateLabel}</div>
                                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-navy-900">
                                        <div
                                            className="h-full rounded-full bg-brand-500"
                                            style={{ width: `${Math.round((d.total / max) * 100)}%` }}
                                        />
                                    </div>
                                    <div className="w-24 text-right text-xs font-semibold text-navy-700 dark:text-white">
                                        {formatCurrency(d.total)}
                                    </div>
                                </div>
                            ));
                        })()}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Reports;
