import React from 'react';
import { useParams } from 'react-router-dom';
import { usePermission } from '@/hooks/use-permission';
import { PermissionContext } from './permission-context';

export const PermissionProvider: React.FC<React.PropsWithChildren> = ({
    children,
}) => {
    const { diagramId } = useParams<{ diagramId: string }>();
    const perm = usePermission(diagramId ?? null);

    return (
        <PermissionContext.Provider value={perm}>
            {children}
        </PermissionContext.Provider>
    );
};
