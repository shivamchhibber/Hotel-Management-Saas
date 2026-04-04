import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { normalizeRole } from 'utils/roleUtils';

const ProtectedRoute = ({ children, requiredRole, fallbackPath = '/auth/sign-in' }) => {
    const { currentUser, userRole, loading } = useAuth();
    const normalizedUserRole = normalizeRole(userRole);
    const normalizedRequiredRole = normalizeRole(requiredRole);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-brand-500"></div>
            </div>
        );
    }

    if (!currentUser) {
        return <Navigate to={fallbackPath} replace />;
    }

    if (normalizedRequiredRole && normalizedUserRole !== normalizedRequiredRole) {
        switch (normalizedUserRole) {
            case 'super_admin':
                return <Navigate to="/super-admin" replace />;
            case 'hotel_owner':
                return <Navigate to="/hotel-owner" replace />;
            case 'hotel_staff':
                return <Navigate to="/hotel-staff" replace />;
            case 'guest':
                return <Navigate to="/guest" replace />;
            default:
                return <Navigate to={fallbackPath} replace />;
        }
    }

    return children;
};

export default ProtectedRoute;
