import { useEffect, useRef } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { useChartDB } from '@/hooks/use-chartdb';
import type { Diagram } from '@/lib/domain/diagram';

const WS_URL = import.meta.env.VITE_COLLAB_WS_URL || 'ws://localhost:8091';

interface UseCollabSyncOptions {
    diagramId: string | null;
    enabled?: boolean;
}

/**
 * Bridges Y.js CRDT ↔ ChartDB provider.
 *
 * Strategy: full state sync via Y.Map.
 *   - On local state change → serialize full diagram → Y.Map.set('diagram', json)
 *   - On remote Y.Map update → deserialize → load into ChartDB
 *   - Skips self-originated updates (origin check)
 */
export function useCollabSync({
    diagramId,
    enabled = true,
}: UseCollabSyncOptions) {
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

    // Stable ref for loadDiagram to avoid exhaustive-deps warning
    const loadDiagramRef = useRef(loadDiagram);
    loadDiagramRef.current = loadDiagram;

    const wsRef = useRef<WebsocketProvider | null>(null);
    const docRef = useRef<Y.Doc | null>(null);
    const originRef = useRef<string>('');
    const applyingRef = useRef(false);

    // Connect / reconnect when diagramId changes
    useEffect(() => {
        if (!diagramId || !enabled) {
            wsRef.current?.destroy();
            docRef.current?.destroy();
            wsRef.current = null;
            docRef.current = null;
            return;
        }

        const doc = new Y.Doc();
        docRef.current = doc;

        const ws = new WebsocketProvider(WS_URL, `diagram-${diagramId}`, doc, {
            connect: true,
        });

        ws.on('sync', () => {
            originRef.current = 'remote';
        });

        // Listen for remote diagram state updates
        const yMap = doc.getMap('state');
        yMap.observe((event) => {
            // Skip local-originated updates
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

    // Publish local changes
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

        const yMap = docRef.current.getMap('state');
        docRef.current.transact(() => {
            // Set origin so remote peers don't echo back
            originRef.current = 'local';
            yMap.set('diagram', JSON.stringify(diagram));
        }, 'local');
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
    ]);

    return;
}
