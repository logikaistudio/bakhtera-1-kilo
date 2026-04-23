import React, { createContext, useState, useEffect, useContext } from 'react';
import { login as loginService, logout as logoutService, validateSession, getUserPermissions } from '../services/authService';

/**
 * Auth Context
 * Provides authentication state and methods throughout the application
 */

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [permissions, setPermissions] = useState({});
    const [loading, setLoading] = useState(true);
    const [sessionToken, setSessionToken] = useState(null);

    // Load session from localStorage on mount
    useEffect(() => {
        const loadSession = async () => {
            try {
                const storedToken = localStorage.getItem('sessionToken');
                if (storedToken) {
                    const sessionData = await validateSession(storedToken);
                    if (sessionData) {
                        setUser(sessionData.user);
                        setPermissions(sessionData.permissions);
                        setSessionToken(storedToken);
                    } else {
                        // Invalid session, clear it
                        localStorage.removeItem('sessionToken');
                    }
                }
            } catch (error) {
                console.error('Error loading session:', error);
                localStorage.removeItem('sessionToken');
            } finally {
                setLoading(false);
            }
        };

        loadSession();
    }, []);

    /**
     * Login function
     * @param {string} username - Username
     * @param {string} password - Password
     */
    const login = async (username, password) => {
        try {
            const result = await loginService(username, password);

            if (result.success) {
                setUser(result.user);
                setPermissions(result.permissions);
                setSessionToken(result.sessionToken);
                localStorage.setItem('sessionToken', result.sessionToken);
                return {
                    success: true,
                    requiresPasswordChange: result.requiresPasswordChange
                };
            } else {
                return { success: false, error: result.error };
            }
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: error.message };
        }
    };

    /**
     * Logout function
     */
    const logout = async () => {
        try {
            if (sessionToken) {
                await logoutService(sessionToken);
            }
            setUser(null);
            setPermissions({});
            setSessionToken(null);
            localStorage.removeItem('sessionToken');
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    /**
     * Refresh permissions only (tanpa re-login)
     * Dipanggil setelah admin mengubah role permissions di Role Management
     */
    const refreshPermissions = async () => {
        try {
            if (!user) return;
            const newPerms = await getUserPermissions(user.id, user.user_level);
            setPermissions(newPerms);
            console.log('[Auth] Permissions refreshed for:', user.user_level);
        } catch (error) {
            console.error('Error refreshing permissions:', error);
        }
    };

    /**
     * Refresh user session and permissions
     */
    const refreshSession = async () => {
        try {
            if (sessionToken) {
                const sessionData = await validateSession(sessionToken);
                if (sessionData) {
                    setUser(sessionData.user);
                    setPermissions(sessionData.permissions);
                } else {
                    await logout();
                }
            }
        } catch (error) {
            console.error('Error refreshing session:', error);
            await logout();
        }
    };

    /**
     * Check if user is authenticated
     */
    const isAuthenticated = () => !!user;

    /**
     * Check if user is super admin
     */
    const isSuperAdmin = () => user?.user_level === 'super_admin';

    /**
     * Check if user is admin (super_admin or admin)
     */
    const isAdmin = () => user?.user_level === 'super_admin' || user?.user_level === 'admin';

    /**
     * Check if user can access a menu
     * @param {string} menuCode - Menu code
     */
    const canAccess = (menuCode) => {
        if (isSuperAdmin() || isAdmin()) return true;
        return permissions[menuCode]?.can_access || false;
    };

    /**
     * Check if user can view in a menu
     * @param {string} menuCode - Menu code
     */
    const canView = (menuCode) => {
        if (isSuperAdmin() || isAdmin()) return true;
        return permissions[menuCode]?.can_view || false;
    };

    /**
     * Check if user can create in a menu
     * @param {string} menuCode - Menu code
     */
    const canCreate = (menuCode) => {
        if (isSuperAdmin() || isAdmin()) return true;
        if (user?.user_level === 'view_only') return false;
        return permissions[menuCode]?.can_create || false;
    };

    /**
     * Check if user can edit in a menu
     * @param {string} menuCode - Menu code
     */
    const canEdit = (menuCode) => {
        if (isSuperAdmin() || isAdmin()) return true;
        if (user?.user_level === 'view_only') return false;
        return permissions[menuCode]?.can_edit || false;
    };

    /**
     * Check if user can delete in a menu
     * @param {string} menuCode - Menu code
     */
    const canDelete = (menuCode) => {
        if (isSuperAdmin() || isAdmin()) return true;
        if (user?.user_level === 'view_only') return false;
        return permissions[menuCode]?.can_delete || false;
    };

    /**
     * Check if user can approve in a menu
     * @param {string} menuCode - Menu code
     */
    const canApprove = (menuCode) => {
        if (isSuperAdmin() || isAdmin()) return true;
        if (user?.user_level === 'view_only') return false;
        return permissions[menuCode]?.can_approve || false;
    };

    /**
     * Check if edit requires approval for this user in a menu
     * @param {string} menuCode - Menu code
     */
    const requiresApprovalForEdit = (menuCode) => {
        if (isSuperAdmin() || isAdmin()) return false;
        return permissions[menuCode]?.requires_approval_for_edit || false;
    };

    /**
     * Check if delete requires approval for this user in a menu
     * @param {string} menuCode - Menu code
     */
    const requiresApprovalForDelete = (menuCode) => {
        if (isSuperAdmin() || isAdmin()) return false;
        return permissions[menuCode]?.requires_approval_for_delete || false;
    };

    /**
     * Get accessible menus
     */
    const getAccessibleMenus = () => {
        if (isSuperAdmin() || isAdmin()) {
            // Return all menus
            return Object.keys(permissions);
        }

        // Return only menus with access permission
        return Object.keys(permissions).filter(menuCode => permissions[menuCode]?.can_access);
    };

    const value = {
        user,
        permissions,
        loading,
        login,
        logout,
        refreshSession,
        refreshPermissions,
        isAuthenticated,
        isSuperAdmin,
        isAdmin,
        canAccess,
        canView,
        canCreate,
        canEdit,
        canDelete,
        canApprove,
        requiresApprovalForEdit,
        requiresApprovalForDelete,
        getAccessibleMenus
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

/**
 * useAuth Hook
 * Access auth context in components
 */
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export default AuthContext;
