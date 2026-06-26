import React, { useEffect, useState } from 'react';
import { StorageProvider } from './storage-provider';
import { PocketBaseProvider } from './pocketbase-provider';

/**
 * Switches between PocketBase (online) and IndexedDB (offline) storage.
 * Listens to navigator.onLine events — seamless fallback.
 */
export const StorageProviderSwitcher: React.FC<React.PropsWithChildren> = ({
    children,
}) => {
    const [online, setOnline] = useState(navigator.onLine);

    useEffect(() => {
        const onLine = () => setOnline(true);
        const offLine = () => setOnline(false);
        window.addEventListener('online', onLine);
        window.addEventListener('offline', offLine);
        return () => {
            window.removeEventListener('online', onLine);
            window.removeEventListener('offline', offLine);
        };
    }, []);

    return online ? (
        <PocketBaseProvider>{children}</PocketBaseProvider>
    ) : (
        <StorageProvider>{children}</StorageProvider>
    );
};
