import React, { useState, useEffect } from "react";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "../../../firebase/config";
import { useAuth } from "contexts/AuthContext";
import Widget from "components/widget/Widget";
import CheckTable from "views/admin/default/components/CheckTable";
import WeeklyRevenue from "views/admin/default/components/WeeklyRevenue";
import TotalSpent from "views/admin/default/components/TotalSpent";
import PieChartCard from "views/admin/default/components/PieChartCard";
import {
    MdTrendingUp,
    MdPeople,
    MdHotel,
    MdCheckCircle,
    MdAttachMoney,
    MdCalendarToday
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

    useEffect(() => {
        if (currentUser) {
            fetchDashboardData();
        }
    }, [currentUser]);

    const fetchDashboardData = async () => {
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

            // Fetch check-ins
            const checkInsQuery = query(
                collection(db, "checkins"),
                where("hotelId", "==", hotelId),
                orderBy("checkInDate", "desc")
            );
            const checkInsSnapshot = await getDocs(checkInsQuery);
            const checkIns = checkInsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Fetch check-outs
            const checkOutsQuery = query(
                collection(db, "checkouts"),
                where("hotelId", "==", hotelId),
                orderBy("checkOutDate", "desc")
            );
            const checkOutsSnapshot = await getDocs(checkOutsQuery);
            const checkOuts = checkOutsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Calculate stats
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const checkInsToday = checkIns.filter(checkin => {
                const checkInDate = checkin.checkInDate?.toDate();
                return checkInDate && checkInDate >= today;
            }).length;

            const checkOutsToday = checkOuts.filter(checkout => {
                const checkOutDate = checkout.checkOutDate?.toDate();
                return checkOutDate && checkOutDate >= today;
            }).length;

            const totalRevenue = checkIns.reduce((sum, checkin) => sum + (checkin.amount || 0), 0);
            const totalGuests = checkIns.length;
            const occupancyRate = Math.round((checkInsToday / 50) * 100); // Assuming 50 rooms max

            setStats({
                totalGuests,
                totalRevenue,
                checkInsToday,
                checkOutsToday,
                occupancyRate
            });

            setRecentCheckIns(checkIns.slice(0, 5));
            setRecentCheckOuts(checkOuts.slice(0, 5));
        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        } finally {
            setLoading(false);
        }
    };

    const checkInColumns = [
        { Header: "Guest Name", accessor: "guestName" },
        { Header: "Room", accessor: "roomNumber" },
        { Header: "Check-in Date", accessor: "checkInDate" },
        { Header: "Amount", accessor: "amount" },
    ];

    const checkOutColumns = [
        { Header: "Guest Name", accessor: "guestName" },
        { Header: "Room", accessor: "roomNumber" },
        { Header: "Check-out Date", accessor: "checkOutDate" },
        { Header: "Amount", accessor: "amount" },
    ];

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(amount);
    };

    const formatDate = (date) => {
        if (!date) return 'N/A';
        const dateObj = date.toDate ? date.toDate() : new Date(date);
        return dateObj.toLocaleDateString();
    };

    const formatCheckInData = (checkIns) => {
        return checkIns.map(checkin => ({
            ...checkin,
            checkInDate: formatDate(checkin.checkInDate),
            amount: formatCurrency(checkin.amount || 0)
        }));
    };

    const formatCheckOutData = (checkOuts) => {
        return checkOuts.map(checkout => ({
            ...checkout,
            checkOutDate: formatDate(checkout.checkOutDate),
            amount: formatCurrency(checkout.amount || 0)
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
                <TotalSpent />
                <WeeklyRevenue />
            </div>

            {/* Recent Check-ins and Check-outs */}
            <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
                {/* Recent Check-ins */}
                <div>
                    <h3 className="mb-4 text-xl font-bold text-navy-700 dark:text-white">
                        Recent Check-ins
                    </h3>
                    <CheckTable
                        columnsData={checkInColumns}
                        tableData={formatCheckInData(recentCheckIns)}
                    />
                </div>

                {/* Recent Check-outs */}
                <div>
                    <h3 className="mb-4 text-xl font-bold text-navy-700 dark:text-white">
                        Recent Check-outs
                    </h3>
                    <CheckTable
                        columnsData={checkOutColumns}
                        tableData={formatCheckOutData(recentCheckOuts)}
                    />
                </div>
            </div>
        </div>
    );
};

export default HotelOwnerDashboard;
