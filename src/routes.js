import React from "react";

// Removed template admin imports to hide demo screens

// Auth Imports
import SignIn from "views/auth/SignIn";
import SignUp from "views/auth/SignUp";

// Icon Imports
import { MdPerson, MdLock } from "react-icons/md";

const routes = [
  // No admin demo routes
  {
    name: "Sign In",
    layout: "/auth",
    path: "sign-in",
    icon: <MdLock className="h-6 w-6" />,
    component: <SignIn />,
  },
  {
    name: "Sign Up",
    layout: "/auth",
    path: "sign-up",
    icon: <MdPerson className="h-6 w-6" />,
    component: <SignUp />,
  },
  // No RTL demo
];
export default routes;
