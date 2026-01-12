import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * ProtectedRoute Component
 * Wrapper for routes that require authentication and optional permissions
 * @param {ReactNode} children - Child components to render if authorized
 * @param {string} menuCode - Optional menu code to check access
 * @param {boolean} requireSuperAdmin - Optional flag to require super admin access
 */
export const ProtectedRoute = ({ children, menuCode, requireSuperAdmin = false }) => {
    const { isAuthenticated, isSuperAdmin, canAccess, loading } = useAuth();

    // Show loading state while checking auth
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    // Redirect to login if not authenticated
    if (!isAuthenticated()) {
        return <Navigate to="/login" replace />;
    }

    // Check super admin requirement
    if (requireSuperAdmin && !isSuperAdmin()) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-red-600 mb-4">Access Denied</h1>
                    <p className="text-gray-600">You do not have permission to access this page.</p>
                    <p className="text-sm text-gray-500 mt-2">This page requires Super Admin access.</p>
                </div>
            </div>
        );
    }

    // Check menu access if menuCode provided
    if (menuCode && !canAccess(menuCode)) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-red-600 mb-4">Access Denied</h1>
                    <p className="text-gray-600">You do not have permission to access this module.</p>
                </div>
            </div>
        );
    }

    // Render children if all checks pass
    return children;
};

export default ProtectedRoute;
