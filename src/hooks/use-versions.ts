import { useState, useCallback } from 'react';
import { pb } from '@/lib/auth';
import type { Diagram } from '@/lib/domain/diagram';

export interface VersionEntry {
    id: string;
    diagramId: string;
    data: Diagram;
    description: string;
    created: string; // ISO date
}

interface UseVersionsReturn {
    versions: VersionEntry[];
    loading: boolean;
    error: string | null;
    fetchVersions: (diagramId: string) => Promise<void>;
    restore: (versionId: string) => Promise<Diagram | null>;
    restoring: boolean;
}

/**
 * Fetch and restore diagram versions from PocketBase.
 *
 * Versions are auto-created by the `versioning.pb.js` hook
 * on every diagram update (onRecordAfterUpdateSuccess).
 */
export function useVersions(): UseVersionsReturn {
    const [versions, setVersions] = useState<VersionEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [restoring, setRestoring] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchVersions = useCallback(async (diagramId: string) => {
        setLoading(true);
        setError(null);
        try {
            const result = await pb
                .collection('diagram_versions')
                .getList(1, 50, {
                    filter: pb.filter('diagram = {:diagramId}', { diagramId }),
                    sort: '-created',
                });

            setVersions(
                result.items.map((item) => {
                    const record = item as Record<string, unknown>;
                    const rawData = record.data;
                    let data: Diagram;
                    if (typeof rawData === 'string') {
                        data = JSON.parse(rawData);
                    } else {
                        data = rawData as unknown as Diagram;
                    }
                    return {
                        id: record.id as string,
                        diagramId: record.diagram as string,
                        data,
                        description:
                            (record.description as string) || 'Auto-saved',
                        created: record.created as string,
                    };
                })
            );
        } catch (e) {
            setError(
                e instanceof Error ? e.message : 'Failed to load versions'
            );
        } finally {
            setLoading(false);
        }
    }, []);

    const restore = useCallback(
        async (versionId: string): Promise<Diagram | null> => {
            setRestoring(true);
            try {
                const record = await pb
                    .collection('diagram_versions')
                    .getOne(versionId);
                const rawData = (record as Record<string, unknown>).data;
                const data: Diagram =
                    typeof rawData === 'string'
                        ? JSON.parse(rawData)
                        : (rawData as unknown as Diagram);
                return data;
            } catch (e) {
                setError(
                    e instanceof Error ? e.message : 'Failed to restore version'
                );
                return null;
            } finally {
                setRestoring(false);
            }
        },
        []
    );

    return { versions, loading, error, fetchVersions, restore, restoring };
}
