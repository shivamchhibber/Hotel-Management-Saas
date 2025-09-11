import React from "react";

// Guest Imports
import MyStays from "views/guest/my-stays";
import Profile from "views/guest/profile";

// Icon Imports
import {
    MdHome,
    MdPerson,
} from "react-icons/md";

const guestRoutes = [
    {
        name: "My Stays",
        layout: "/guest",
        path: "my-stays",
        icon: <MdHome className="h-6 w-6" />,
        component: <MyStays />,
    },
    {
        name: "Profile",
        layout: "/guest",
        path: "profile",
        icon: <MdPerson className="h-6 w-6" />,
        component: <Profile />,
    },
];

export default guestRoutes;
