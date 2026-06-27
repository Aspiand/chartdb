import { useState, useEffect } from 'react';
import { pb } from '@/lib/auth';

interface PermissionState {
    canEdit: boolean;
    isOwner: boolean;
    loading: boolean;
}

/**
 * Checks if current user can edit the given diagram.
 *
 * Logic:
 *   - Not logged in → canEdit=false
 *   - Is owner → canEdit=true
 *   - Is collaborator with "edit" permission → canEdit=true
 *   - Otherwise → canEdit=false (view-only)
 */
export function usePermission(diagramId: string | null): PermissionState {
    const [state, setState] = useState<PermissionState>({
        canEdit: false,
        isOwner: false,
        loading: true,
    });

    useEffect(() => {
        if (!diagramId) {
            setState({ canEdit: false, isOwner: false, loading: false });
            return;
        }

        let cancelled = false;

        const check = async () => {
            setState((s) => ({ ...s, loading: true }));

            try {
                const user = pb.authStore.record;
                if (!user) {
                    if (!cancelled)
                        setState({
                            canEdit: false,
                            isOwner: false,
                            loading: false,
                        });
                    return;
                }

                // 1. Get diagram → check owner
                const diagram = await pb
                    .collection('diagrams')
                    .getOne(diagramId);

                if (diagram.owner === user.id) {
                    if (!cancelled)
                        setState({
                            canEdit: true,
                            isOwner: true,
                            loading: false,
                        });
                    return;
                }

                // 2. Check if user is edit collaborator
                const collabs = await pb
                    .collection('diagram_collaborators')
                    .getList(1, 1, {
                        filter: pb.filter(
                            'diagram = {:diagramId} && user = {:userId}',
                            { diagramId, userId: user.id }
                        ),
                    });

                const canEdit =
                    collabs.items.length > 0 &&
                    (collabs.items[0] as Record<string, unknown>).permission ===
                        'edit';

                if (!cancelled)
                    setState({ canEdit, isOwner: false, loading: false });
            } catch {
                // PB unreachable → fallback: allow edit (offline mode)
                if (!cancelled)
                    setState({ canEdit: true, isOwner: true, loading: false });
            }
        };

        check();
        return () => {
            cancelled = true;
        };
    }, [diagramId]);

    return state;
}
