import { useEffect, useRef, useCallback, useState } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { useChartDB } from '@/hooks/use-chartdb';
import { pb } from '@/lib/auth';
import type { Diagram } from '@/lib/domain/diagram';

const WS_URL = import.meta.env.VITE_COLLAB_WS_URL || 'ws://localhost:8091';

type SyncStatus = 'disconnected' | 'connecting' | 'synced';
type PersistStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UseCollabSyncOptions {
    diagramId: string | null;
    enabled?: boolean;
}

interface UseCollabSyncReturn {
    syncStatus: SyncStatus;
    persistStatus: PersistStatus;
    lastSyncAt: Date | null;
}

/**
 * Bridges Y.js CRDT ↔ ChartDB provider + PB persist.
 *
 * 1. Local state change → broadcast via Y.Map → y-websocket peers
 * 2. Remote Y.Map update → load into ChartDB (origin check prevents echo)
 * 3. Debounced (2s) persist to PB `diagrams.data` blob → triggers versioning hook
 */
export function useCollabSync({
    diagramId,
    enabled = true,
}: UseCollabSyncOptions): UseCollabSyncReturn {
    const chartDB = useChartDB();
    const {
        currentDiagram,
        tables,
        relationships,
        dependencies,
        areas,
        customTypes,
        notes,
        databaseType,
        loadDiagram,
    } = chartDB;

    // ── State machine ───────────────────────────────────
    const [syncStatus, setSyncStatus] = useState<SyncStatus>('disconnected');
    const [persistStatus, setPersistStatus] = useState<PersistStatus>('idle');
    const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

    // Refs for lifecycle management
    const loadDiagramRef = useRef(loadDiagram);
    loadDiagramRef.current = loadDiagram;

    const wsRef = useRef<WebsocketProvider | null>(null);
    const docRef = useRef<Y.Doc | null>(null);
    const applyingRef = useRef(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Persist to PB (debounced) ───────────────────────
    const persistToPB = useCallback((diagram: Diagram) => {
        // Skip if not logged in
        if (!pb.authStore.record) return;

        // Clear any pending debounce
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        debounceRef.current = setTimeout(async () => {
            // Double-check Y.doc is still synced before persisting
            if (!wsRef.current || !wsRef.current.shouldConnect) return;

            setPersistStatus('saving');
            try {
                const data = JSON.stringify(diagram);
                await pb.collection('diagrams').update(diagram.id, { data });
                setPersistStatus('saved');
                setLastSyncAt(new Date());
            } catch {
                setPersistStatus('error');
            }
        }, 2000);
    }, []);

    // Cleanup debounce on unmount
    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, []);

    // ── Connect / reconnect when diagramId changes ─────
    useEffect(() => {
        if (!diagramId || !enabled) {
            wsRef.current?.destroy();
            docRef.current?.destroy();
            wsRef.current = null;
            docRef.current = null;
            setSyncStatus('disconnected');
            return;
        }

        setSyncStatus('connecting');

        const doc = new Y.Doc();
        docRef.current = doc;

        const ws = new WebsocketProvider(WS_URL, `diagram-${diagramId}`, doc, {
            connect: true,
        });

        ws.on('sync', (synced: boolean) => {
            if (synced) {
                setSyncStatus('synced');
            }
        });

        ws.on('status', ({ status }: { status: string }) => {
            if (status === 'connected') {
                setSyncStatus('synced');
            } else if (status === 'connecting') {
                setSyncStatus('connecting');
            } else if (status === 'disconnected') {
                setSyncStatus('disconnected');
            }
        });

        // Listen for remote diagram state updates
        const yMap = doc.getMap('state');
        yMap.observe((event) => {
            // Skip local-originated updates — don't echo back
            if (event.transaction.origin === 'local') return;

            const raw = yMap.get('diagram');
            if (!raw || typeof raw !== 'string') return;

            try {
                const remoteDiagram = JSON.parse(raw) as Diagram;
                applyingRef.current = true;
                loadDiagramRef.current(remoteDiagram.id);
                applyingRef.current = false;
            } catch {
                // malformed data — ignore
            }
        });

        wsRef.current = ws;

        return () => {
            ws.destroy();
            doc.destroy();
            wsRef.current = null;
            docRef.current = null;
        };
    }, [diagramId, enabled]);

    // ── Publish local changes + persist ────────
    useEffect(() => {
        if (!wsRef.current || !docRef.current || !currentDiagram || !diagramId)
            return;
        if (applyingRef.current) return; // skip if we're applying remote

        const diagram: Diagram = {
            id: currentDiagram.id,
            name: currentDiagram.name,
            databaseType: databaseType!,
            tables,
            relationships,
            dependencies,
            areas,
            customTypes,
            notes,
            createdAt: currentDiagram.createdAt,
            updatedAt: new Date(),
        };

        // Broadcast to peers via Y.Map
        const yMap = docRef.current.getMap('state');
        docRef.current.transact(() => {
            yMap.set('diagram', JSON.stringify(diagram));
        }, 'local');

        // Debounced persist to PB
        persistToPB(diagram);
    }, [
        diagramId,
        currentDiagram,
        tables,
        relationships,
        dependencies,
        areas,
        customTypes,
        notes,
        databaseType,
        persistToPB,
    ]);

    return { syncStatus, persistStatus, lastSyncAt };
}
