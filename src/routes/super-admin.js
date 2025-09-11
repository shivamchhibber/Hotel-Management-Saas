import React from "react";

// Super Admin Imports
import SuperAdminDashboard from "views/super-admin/dashboard";
import HotelManagement from "views/super-admin/hotel-management";
import UserManagement from "views/super-admin/user-management";

// Icon Imports
import {
    MdHome,
    MdBusiness,
    MdPeople,
    MdSettings,
} from "react-icons/md";

const superAdminRoutes = [
    {
        name: "Dashboard",
        layout: "/super-admin",
        path: "dashboard",
        icon: <MdHome className="h-6 w-6" />,
        component: <SuperAdminDashboard />,
    },
    {
        name: "Hotel Management",
        layout: "/super-admin",
        path: "hotels",
        icon: <MdBusiness className="h-6 w-6" />,
        component: <HotelManagement />,
    },
    {
        name: "User Management",
        layout: "/super-admin",
        path: "users",
        icon: <MdPeople className="h-6 w-6" />,
        component: <UserManagement />,
    },
];

export default superAdminRoutes;
