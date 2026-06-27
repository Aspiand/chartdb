import { useEffect, useRef, useCallback } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

const WS_URL = import.meta.env.VITE_COLLAB_WS_URL || 'ws://localhost:8091';

interface UseCollabOptions {
    diagramId: string | null;
    enabled?: boolean;
    onSync?: () => void;
}

interface UseCollabReturn {
    doc: Y.Doc | null;
    connected: boolean;
    disconnect: () => void;
    reconnect: () => void;
}

export function useCollab({
    diagramId,
    enabled = true,
    onSync,
}: UseCollabOptions): UseCollabReturn {
    const docRef = useRef<Y.Doc | null>(null);
    const wsRef = useRef<WebsocketProvider | null>(null);
    const connectedRef = useRef(false);

    const disconnect = useCallback(() => {
        wsRef.current?.disconnect();
        wsRef.current?.destroy();
        wsRef.current = null;
        docRef.current?.destroy();
        docRef.current = null;
        connectedRef.current = false;
    }, []);

    const reconnect = useCallback(() => {
        if (!diagramId || !enabled) return;
        disconnect();

        const doc = new Y.Doc();
        docRef.current = doc;

        const ws = new WebsocketProvider(WS_URL, `diagram-${diagramId}`, doc, {
            connect: true,
        });

        ws.on('sync', (synced: boolean) => {
            connectedRef.current = synced;
            if (synced) onSync?.();
        });

        ws.on('status', ({ status }: { status: string }) => {
            connectedRef.current = status === 'connected';
        });

        wsRef.current = ws;
    }, [diagramId, enabled, disconnect, onSync]);

    useEffect(() => {
        if (!diagramId || !enabled) {
            disconnect();
            return;
        }

        reconnect();

        return () => {
            disconnect();
        };
    }, [diagramId, enabled, reconnect, disconnect]);

    return {
        doc: docRef.current,
        connected: connectedRef.current,
        disconnect,
        reconnect,
    };
}
