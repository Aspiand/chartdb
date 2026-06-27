import { createContext, useContext } from 'react';

export interface PermissionContextValue {
    canEdit: boolean;
    isOwner: boolean;
    loading: boolean;
}

export const PermissionContext = createContext<PermissionContextValue>({
    canEdit: true,
    isOwner: true,
    loading: false,
});

export const useEditorPermission = () => useContext(PermissionContext);
