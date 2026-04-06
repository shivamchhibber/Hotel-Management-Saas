import React, { useState, useEffect } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../../firebase/config";
import Widget from "components/widget/Widget";
import CheckTable from "views/admin/default/components/CheckTable";
import {
    MdBusiness,
    MdPeople,
    MdTrendingUp,
    MdCheckCircle,
} from "react-icons/md";

/** Firestore orderBy('createdAt') omits docs without that field; sort client-side instead. */
function createdAtMs(data) {
    const c = data?.createdAt;
    if (c == null) return 0;
    if (typeof c === "number") return c;
    if (typeof c.toMillis === "function") return c.toMillis();
    if (typeof c.toDate === "function") return c.toDate().getTime();
    if (typeof c.seconds === "number") return c.seconds * 1000;
    if (c instanceof Date) return c.getTime();
    return 0;
}

const superAdminListHotels = httpsCallable(functions, "superAdminListHotels");
const superAdminListUsers = httpsCallable(functions, "superAdminListUsers");

const SuperAdminDashboard = () => {
    const [stats, setStats] = useState({
        totalHotels: 0,
        totalUsers: 0,
        activeHotels: 0,
        totalRevenue: 0
    });
    const [recentHotels, setRecentHotels] = useState([]);
    const [recentUsers, setRecentUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);

            const [hotelsRes, usersRes] = await Promise.all([
                superAdminListHotels(),
                superAdminListUsers(),
            ]);
            const hotels = (Array.isArray(hotelsRes.data?.hotels) ? hotelsRes.data.hotels : [])
                .sort((a, b) => createdAtMs(b) - createdAtMs(a));
            const users = (Array.isArray(usersRes.data?.users) ? usersRes.data.users : [])
                .sort((a, b) => createdAtMs(b) - createdAtMs(a));

            // Calculate stats
            const activeHotels = hotels.filter(hotel => hotel.isActive).length;
            const totalRevenue = hotels.reduce((sum, hotel) => sum + (hotel.totalRevenue || 0), 0);

            setStats({
                totalHotels: hotels.length,
                totalUsers: users.length,
                activeHotels,
                totalRevenue
            });

            setRecentHotels(hotels.slice(0, 5));
            setRecentUsers(users.slice(0, 5));
        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        } finally {
            setLoading(false);
        }
    };

    const hotelColumns = [
        { Header: "Hotel Name", accessor: "name" },
        { Header: "Owner", accessor: "ownerId" },
        { Header: "Address", accessor: "address" },
        { Header: "Active", accessor: "isActive" },
        { Header: "Created At", accessor: "createdAt" },
    ];

    const userColumns = [
        { Header: "Name", accessor: "displayName" },
        { Header: "Email", accessor: "email" },
        { Header: "Role", accessor: "role" },
        { Header: "Active", accessor: "isActive" },
        { Header: "Created At", accessor: "createdAt" },
    ];

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
            {/* Stats Cards */}
            <div className="mt-3 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
                <Widget
                    icon={<MdBusiness className="h-7 w-7" />}
                    title={"Total Hotels"}
                    subtitle={stats.totalHotels.toString()}
                />
                <Widget
                    icon={<MdPeople className="h-6 w-6" />}
                    title={"Total Users"}
                    subtitle={stats.totalUsers.toString()}
                />
                <Widget
                    icon={<MdCheckCircle className="h-7 w-7" />}
                    title={"Active Hotels"}
                    subtitle={stats.activeHotels.toString()}
                />
                <Widget
                    icon={<MdTrendingUp className="h-6 w-6" />}
                    title={"Total Revenue"}
                    subtitle={formatCurrency(stats.totalRevenue)}
                />
            </div>

            {/* Recent Hotels and Users */}
            <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
                {/* Recent Hotels */}
                <div>
                    <h3 className="mb-4 text-xl font-bold text-navy-700 dark:text-white">
                        Recent Hotels
                    </h3>
                    <CheckTable title="Recent Hotels" columnsData={hotelColumns} tableData={recentHotels} />
                </div>

                {/* Recent Users */}
                <div>
                    <h3 className="mb-4 text-xl font-bold text-navy-700 dark:text-white">
                        Recent Users
                    </h3>
                    <CheckTable title="Recent Users" columnsData={userColumns} tableData={recentUsers} />
                </div>
            </div>
        </div>
    );
};

export default SuperAdminDashboard;
