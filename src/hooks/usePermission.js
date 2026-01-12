import { useAuth } from '../context/AuthContext';

/**
 * usePermission Hook
 * Convenience hook for checking permissions on a specific menu
 * @param {string} menuCode - Menu code to check permissions for
 */
export const usePermission = (menuCode) => {
    const {
        canAccess,
        canView,
        canCreate,
        canEdit,
        canDelete,
        canApprove,
        requiresApprovalForEdit,
        requiresApprovalForDelete
    } = useAuth();

    return {
        canAccess: canAccess(menuCode),
        canView: canView(menuCode),
        canCreate: canCreate(menuCode),
        canEdit: canEdit(menuCode),
        canDelete: canDelete(menuCode),
        canApprove: canApprove(menuCode),
        requiresApprovalForEdit: requiresApprovalForEdit(menuCode),
        requiresApprovalForDelete: requiresApprovalForDelete(menuCode)
    };
};
