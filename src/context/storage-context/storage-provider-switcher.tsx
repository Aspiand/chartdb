import React, { useEffect, useState } from 'react';
import { StorageProvider } from './storage-provider';
import { PocketBaseProvider } from './pocketbase-provider';

const PB_URL = import.meta.env.VITE_POCKETBASE_URL || 'http://localhost:8090';
const HEALTH_TIMEOUT_MS = 3000;

type ProviderMode = 'offline' | 'online' | 'checking';

/**
 * Switches between PocketBase (online) and IndexedDB (offline).
 *
 * - On mount: checks PB `/api/health` — fast timeout, non-blocking.
 * - Falls back to IndexedDB if PB unreachable.
 * - Online → retry health check, switch if PB back.
 * - Offline → auto fallback to IndexedDB.
 */
export const StorageProviderSwitcher: React.FC<React.PropsWithChildren> = ({
    children,
}) => {
    const [mode, setMode] = useState<ProviderMode>('checking');

    const checkHealth = async (): Promise<boolean> => {
        if (!navigator.onLine) return false;
        try {
            const controller = new AbortController();
            const timer = setTimeout(
                () => controller.abort(),
                HEALTH_TIMEOUT_MS
            );
            const res = await fetch(`${PB_URL}/api/health`, {
                signal: controller.signal,
            });
            clearTimeout(timer);
            return res.ok;
        } catch {
            return false;
        }
    };

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            const ok = await checkHealth();
            if (cancelled) return;
            setMode(ok ? 'online' : 'offline');
        };

        run();

        const onOnline = () => run();
        const onOffline = () => setMode('offline');

        window.addEventListener('online', onOnline);
        window.addEventListener('offline', onOffline);
        return () => {
            cancelled = true;
            window.removeEventListener('online', onOnline);
            window.removeEventListener('offline', onOffline);
        };
    }, []);

    if (mode === 'checking') {
        // Show IndexedDB provider while checking — no blank screen
        return <StorageProvider>{children}</StorageProvider>;
    }

    return mode === 'online' ? (
        <PocketBaseProvider>{children}</PocketBaseProvider>
    ) : (
        <StorageProvider>{children}</StorageProvider>
    );
};
