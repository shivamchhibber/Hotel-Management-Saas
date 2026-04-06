import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "../../../firebase/config";
import { useAuth } from "contexts/AuthContext";
import { resolveHotelIdForOwner } from "utils/hotelOwnerUtils";
import { ownerListStaysFn } from "utils/ownerCallables";
import Widget from "components/widget/Widget";
import CheckTable from "views/admin/default/components/CheckTable";
import {
    MdPeople,
    MdCheckCircle,
    MdAttachMoney,
    MdCalendarToday,
    MdHotel,
} from "react-icons/md";

const HotelOwnerDashboard = () => {
    const { currentUser } = useAuth();
    const [stats, setStats] = useState({
        totalGuests: 0,
        totalRevenue: 0,
        checkInsToday: 0,
        checkOutsToday: 0,
        occupancyRate: 0
    });
    const [recentCheckIns, setRecentCheckIns] = useState([]);
    const [recentCheckOuts, setRecentCheckOuts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [missingHotel, setMissingHotel] = useState(false);

    const fetchDashboardData = useCallback(async () => {
        try {
            setLoading(true);

            const hotelId = await resolveHotelIdForOwner(currentUser.uid);

            if (!hotelId) {
                setMissingHotel(true);
                setStats({
                    totalGuests: 0,
                    totalRevenue: 0,
                    checkInsToday: 0,
                    checkOutsToday: 0,
                    occupancyRate: 0,
                });
                setRecentCheckIns([]);
                setRecentCheckOuts([]);
                return;
            }
            setMissingHotel(false);

            let stays = [];
            try {
                const { data } = await ownerListStaysFn({});
                stays = Array.isArray(data?.stays) ? data.stays : [];
            } catch (callableErr) {
                console.warn("ownerListStays failed; falling back to Firestore query:", callableErr);
                const staysQuery = query(
                    collection(db, "stays"),
                    where("hotelId", "==", hotelId),
                    orderBy("checkInAt", "desc"),
                );
                const staysSnap = await getDocs(staysQuery);
                stays = staysSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
            }

            // Calculate stats
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const activeStays = stays.filter((s) => !s.checkOutAt);
            const completedStays = stays.filter((s) => !!s.checkOutAt);

            const checkInsToday = stays.filter((s) => {
                const d = s.checkInAt?.toDate ? s.checkInAt.toDate() : new Date(s.checkInAt);
                return d && d >= today;
            }).length;

            const checkOutsToday = completedStays.filter((s) => {
                const d = s.checkOutAt?.toDate ? s.checkOutAt.toDate() : new Date(s.checkOutAt);
                return d && d >= today;
            }).length;

            const totalRevenue = completedStays.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);
            const totalGuests = stays.length;
            const occupancyRate = Math.round((activeStays.length / 50) * 100); // TODO: replace 50 with hotel room count

            setStats({
                totalGuests,
                totalRevenue,
                checkInsToday,
                checkOutsToday,
                occupancyRate
            });

            setRecentCheckIns(activeStays.slice(0, 5));
            setRecentCheckOuts(completedStays.slice(0, 5));
        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        } finally {
            setLoading(false);
        }
    }, [currentUser]);

    useEffect(() => {
        if (currentUser) {
            fetchDashboardData();
        }
    }, [currentUser, fetchDashboardData]);

    const checkInColumns = [
        { Header: "Guest Name", accessor: "guestName" },
        { Header: "Room", accessor: "roomNumber" },
        { Header: "Check-in Date", accessor: "checkInAt" },
        { Header: "Expected Total", accessor: "totalAmount" },
    ];

    const checkOutColumns = [
        { Header: "Guest Name", accessor: "guestName" },
        { Header: "Room", accessor: "roomNumber" },
        { Header: "Check-out Date", accessor: "checkOutAt" },
        { Header: "Total", accessor: "totalAmount" },
    ];

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(amount);
    };

    const toDateObj = (v) => {
        if (!v) return null;
        if (v?.toDate) return v.toDate();
        const d = new Date(v);
        return Number.isFinite(d.getTime()) ? d : null;
    };

    const formatDay = (d) => {
        if (!d) return "—";
        return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
    };

    const formatDate = (date) => {
        if (!date) return 'N/A';
        const dateObj = date.toDate ? date.toDate() : new Date(date);
        return dateObj.toLocaleDateString();
    };

    const formatCheckInData = (rows) => {
        return rows.map((s) => ({
            ...s,
            guestName: s.guestName || "—",
            roomNumber: s.roomNumber || "—",
            checkInAt: formatDate(s.checkInAt),
            totalAmount: formatCurrency(Number(s.totalAmount || 0)),
        }));
    };

    const formatCheckOutData = (rows) => {
        return rows.map((s) => ({
            ...s,
            guestName: s.guestName || "—",
            roomNumber: s.roomNumber || "—",
            checkOutAt: formatDate(s.checkOutAt),
            totalAmount: formatCurrency(Number(s.totalAmount || 0)),
        }));
    };

    const buildRevenueTrend = (rows) => {
        // last 7 checkout-days
        const byDay = new Map();
        for (const s of rows) {
            const d = toDateObj(s.checkOutAt);
            if (!d) continue;
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            byDay.set(key, (byDay.get(key) || 0) + Number(s.totalAmount || 0));
        }
        const sorted = Array.from(byDay.entries())
            .sort((a, b) => (a[0] < b[0] ? 1 : -1))
            .slice(0, 7)
            .map(([key, amount]) => {
                const d = new Date(`${key}T00:00:00`);
                return { key, label: formatDay(d), amount };
            })
            .reverse();

        const max = sorted.reduce((m, r) => Math.max(m, r.amount), 0) || 1;
        return sorted.map((r) => ({ ...r, pct: Math.round((r.amount / max) * 100) }));
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
                        A super admin must create your hotel in Hotel Management using your sign-up email, or your{" "}
                        <code className="rounded bg-white/60 px-1 dark:bg-black/30">hotels.ownerId</code> must match your
                        Firebase Auth user ID in Firestore.
                    </p>
                </div>
            )}
            {!missingHotel && (
                <Link
                    to="/hotel-owner/rooms"
                    className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4 text-navy-800 transition hover:bg-brand-100 dark:border-brand-900/40 dark:bg-brand-950/30 dark:text-white dark:hover:bg-brand-900/40"
                >
                    <MdHotel className="h-8 w-8 shrink-0 text-brand-600 dark:text-brand-400" />
                    <div className="min-w-0 flex-1">
                        <p className="font-semibold">Live room status</p>
                        <p className="text-sm opacity-90">
                            Room Management shows real-time counts and each room&apos;s status (available, checked in,
                            occupied, maintenance).
                        </p>
                    </div>
                    <span className="shrink-0 text-sm font-medium text-brand-600 dark:text-brand-400">View →</span>
                </Link>
            )}
            {/* Stats Cards */}
            <div className="mt-3 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
                <Widget
                    icon={<MdPeople className="h-7 w-7" />}
                    title={"Total Guests"}
                    subtitle={stats.totalGuests.toString()}
                />
                <Widget
                    icon={<MdAttachMoney className="h-6 w-6" />}
                    title={"Total Revenue"}
                    subtitle={formatCurrency(stats.totalRevenue)}
                />
                <Widget
                    icon={<MdCheckCircle className="h-7 w-7" />}
                    title={"Check-ins Today"}
                    subtitle={stats.checkInsToday.toString()}
                />
                <Widget
                    icon={<MdCalendarToday className="h-6 w-6" />}
                    title={"Occupancy Rate"}
                    subtitle={`${stats.occupancyRate}%`}
                />
            </div>

            {/* Charts */}
            <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 dark:bg-navy-800 dark:ring-white/10">
                    <div className="flex items-center justify-between">
                        <p className="text-base font-bold text-navy-700 dark:text-white">Revenue trend</p>
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Last 7 checkout days</p>
                    </div>
                    <div className="mt-4 space-y-3">
                        {buildRevenueTrend(recentCheckOuts).length === 0 ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400">No revenue yet.</p>
                        ) : (
                            buildRevenueTrend(recentCheckOuts).map((r) => (
                                <div key={r.key} className="flex items-center gap-3">
                                    <p className="w-14 shrink-0 text-xs font-semibold text-gray-500 dark:text-gray-400">{r.label}</p>
                                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                                        <div
                                            className="h-full rounded-full bg-brand-500"
                                            style={{ width: `${r.pct}%` }}
                                        />
                                    </div>
                                    <p className="w-28 shrink-0 text-right text-xs font-semibold text-navy-700 dark:text-white">
                                        {formatCurrency(r.amount)}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                </div>
                <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 dark:bg-navy-800 dark:ring-white/10">
                    <p className="text-base font-bold text-navy-700 dark:text-white">Quick actions</p>
                    <div className="mt-4 grid grid-cols-1 gap-3">
                        <Link to="/hotel-owner/rooms" className="al-btn-secondary text-center">
                            View rooms
                        </Link>
                        <Link to="/hotel-owner/guests" className="al-btn-secondary text-center">
                            View guests
                        </Link>
                        <Link to="/hotel-owner/reports" className="al-btn-primary text-center">
                            Open reports
                        </Link>
                    </div>
                </div>
            </div>

            {/* Recent Check-ins and Check-outs */}
            <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
                {/* Recent Check-ins */}
                <div>
                    <h3 className="mb-4 text-xl font-bold text-navy-700 dark:text-white">
                        Recent Check-ins
                    </h3>
                    <div className="space-y-3 md:hidden">
                        {recentCheckIns.length === 0 ? (
                            <div className="rounded-2xl bg-white p-4 text-sm text-gray-500 shadow-sm ring-1 ring-black/5 dark:bg-navy-800 dark:text-gray-400 dark:ring-white/10">
                                No check-ins yet.
                            </div>
                        ) : (
                            recentCheckIns.map((s) => (
                                <div key={s.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 dark:bg-navy-800 dark:ring-white/10">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-base font-semibold text-navy-700 dark:text-white">{s.guestName || "—"}</p>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">Room {s.roomNumber || "—"}</p>
                                        </div>
                                        <p className="text-sm font-semibold text-navy-700 dark:text-white">
                                            {formatCurrency(Number(s.totalAmount || 0))}
                                        </p>
                                    </div>
                                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                        {formatDate(s.checkInAt)}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                    <div className="hidden md:block">
                        <CheckTable
                            columnsData={checkInColumns}
                            tableData={formatCheckInData(recentCheckIns)}
                        />
                    </div>
                </div>

                {/* Recent Check-outs */}
                <div>
                    <h3 className="mb-4 text-xl font-bold text-navy-700 dark:text-white">
                        Recent Check-outs
                    </h3>
                    <div className="space-y-3 md:hidden">
                        {recentCheckOuts.length === 0 ? (
                            <div className="rounded-2xl bg-white p-4 text-sm text-gray-500 shadow-sm ring-1 ring-black/5 dark:bg-navy-800 dark:text-gray-400 dark:ring-white/10">
                                No check-outs yet.
                            </div>
                        ) : (
                            recentCheckOuts.map((s) => (
                                <div key={s.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 dark:bg-navy-800 dark:ring-white/10">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-base font-semibold text-navy-700 dark:text-white">{s.guestName || "—"}</p>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">Room {s.roomNumber || "—"}</p>
                                        </div>
                                        <p className="text-sm font-semibold text-navy-700 dark:text-white">
                                            {formatCurrency(Number(s.totalAmount || 0))}
                                        </p>
                                    </div>
                                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                        {formatDate(s.checkOutAt)}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                    <div className="hidden md:block">
                        <CheckTable
                            columnsData={checkOutColumns}
                            tableData={formatCheckOutData(recentCheckOuts)}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HotelOwnerDashboard;
