import React from "react";

// Hotel Staff Imports
import StaffRoomManagement from "views/hotel-staff/room-management";
import StaffProfile from "views/hotel-staff/profile";

// Icon Imports
import {
    MdHotel,
    MdPerson,
} from "react-icons/md";

const hotelStaffRoutes = [
    {
        name: "Dashboard",
        layout: "/hotel-staff",
        path: "profile",
        icon: <MdPerson className="h-6 w-6" />,
        component: <StaffProfile />,
    },
    {
        name: "Room Management",
        layout: "/hotel-staff",
        path: "rooms",
        icon: <MdHotel className="h-6 w-6" />,
        component: <StaffRoomManagement />,
    },
];

export default hotelStaffRoutes;
