import React from "react";

// Hotel Owner Imports
import HotelOwnerDashboard from "views/hotel-owner/dashboard";
import StaffManagement from "views/hotel-owner/staff-management";
import GuestManagement from "views/hotel-owner/guest-management";
import Reports from "views/hotel-owner/reports";
import RoomManagement from "views/hotel-owner/room-management";

// Icon Imports
import {
    MdHome,
    MdPeople,
    MdPerson,
    MdBarChart,
    MdHotel,
} from "react-icons/md";

const hotelOwnerRoutes = [
    {
        name: "Dashboard",
        layout: "/hotel-owner",
        path: "dashboard",
        icon: <MdHome className="h-6 w-6" />,
        component: <HotelOwnerDashboard />,
    },
    {
        name: "Room Management",
        layout: "/hotel-owner",
        path: "rooms",
        icon: <MdHotel className="h-6 w-6" />,
        component: <RoomManagement />,
    },
    {
        name: "Staff Management",
        layout: "/hotel-owner",
        path: "staff",
        icon: <MdPeople className="h-6 w-6" />,
        component: <StaffManagement />,
    },
    {
        name: "Guest Management",
        layout: "/hotel-owner",
        path: "guests",
        icon: <MdPerson className="h-6 w-6" />,
        component: <GuestManagement />,
    },
    {
        name: "Reports",
        layout: "/hotel-owner",
        path: "reports",
        icon: <MdBarChart className="h-6 w-6" />,
        component: <Reports />,
    },
];

export default hotelOwnerRoutes;
