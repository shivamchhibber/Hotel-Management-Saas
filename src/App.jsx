import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "contexts/AuthContext";
import { normalizeRole } from "utils/roleUtils";

import RtlLayout from "layouts/rtl";
import AdminLayout from "layouts/admin";
import AuthLayout from "layouts/auth";
import SuperAdminLayout from "layouts/super-admin";
import HotelOwnerLayout from "layouts/hotel-owner";
import HotelStaffLayout from "layouts/hotel-staff";
import GuestLayout from "layouts/guest";

const App = () => {
  const RoleRedirect = () => {
    const { currentUser, userRole, loading } = useAuth();
    if (loading) return null;
    if (!currentUser) return <Navigate to="/auth/sign-in" replace />;
    switch (normalizeRole(userRole)) {
      case 'super_admin':
        return <Navigate to="/super-admin/dashboard" replace />;
      case 'hotel_owner':
        return <Navigate to="/hotel-owner/dashboard" replace />;
      case 'hotel_staff':
        return <Navigate to="/hotel-staff/profile" replace />;
      case 'guest':
        return <Navigate to="/guest/my-stays" replace />;
      default:
        return <Navigate to="/auth/sign-in" replace />;
    }
  };

  const AuthGate = ({ children }) => {
    const { currentUser, userRole, loading } = useAuth();
    if (loading) return null;
    if (currentUser && userRole) {
      return <RoleRedirect />;
    }
    return children;
  };

  return (
    <AuthProvider>
      <Routes>
        <Route
          path="auth/*"
          element={
            <AuthGate>
              <AuthLayout />
            </AuthGate>
          }
        />
        <Route path="super-admin/*" element={<SuperAdminLayout />} />
        <Route path="hotel-owner/*" element={<HotelOwnerLayout />} />
        <Route path="hotel-staff/*" element={<HotelStaffLayout />} />
        <Route path="guest/*" element={<GuestLayout />} />
        <Route path="admin/*" element={<AdminLayout />} />
        <Route path="rtl/*" element={<RtlLayout />} />
        <Route path="/" element={<RoleRedirect />} />
        <Route path="*" element={<RoleRedirect />} />
      </Routes>
    </AuthProvider>
  );
};

export default App;
