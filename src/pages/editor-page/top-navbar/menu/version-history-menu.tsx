import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MenubarItem, MenubarSeparator } from '@/components/menubar/menubar';
import { useVersions } from '@/hooks/use-versions';
import { useChartDB } from '@/hooks/use-chartdb';
import { Spinner } from '@/components/spinner/spinner';

/**
 * Version history dropdown inside the "Versions" menu.
 * Lists all snapshots with timestamp, lets user restore one.
 */
export const VersionHistoryMenu: React.FC = () => {
    const { diagramId } = useParams<{ diagramId: string }>();
    const { loadDiagramFromData } = useChartDB();
    const { versions, loading, error, fetchVersions, restore, restoring } =
        useVersions();
    const [restoreId, setRestoreId] = useState<string | null>(null);

    useEffect(() => {
        if (diagramId) fetchVersions(diagramId);
    }, [diagramId, fetchVersions]);

    const handleRestore = async (versionId: string) => {
        setRestoreId(versionId);
        const diagram = await restore(versionId);
        if (diagram) {
            loadDiagramFromData(diagram);
        }
        setRestoreId(null);
    };

    if (loading) {
        return (
            <MenubarItem disabled>
                <Spinner size="small" />
                <span className="ml-2">Loading versions...</span>
            </MenubarItem>
        );
    }

    if (error) {
        return <MenubarItem disabled>Error: {error}</MenubarItem>;
    }

    if (versions.length === 0) {
        return (
            <MenubarItem disabled>
                No versions yet — save diagram first
            </MenubarItem>
        );
    }

    return (
        <>
            {versions.map((v) => (
                <MenubarItem
                    key={v.id}
                    onClick={() => handleRestore(v.id)}
                    disabled={restoring || !diagramId}
                >
                    <div className="flex w-full min-w-[220px] items-center justify-between gap-3">
                        <span className="text-xs text-muted-foreground">
                            {new Date(v.created).toLocaleString()}
                        </span>
                        <span className="text-xs font-medium text-blue-600">
                            {restoreId === v.id ? 'Restoring...' : 'Restore'}
                        </span>
                    </div>
                </MenubarItem>
            ))}
            <MenubarSeparator />
            <MenubarItem disabled className="text-[10px] text-muted-foreground">
                Auto-saved on every diagram update
            </MenubarItem>
        </>
    );
};
