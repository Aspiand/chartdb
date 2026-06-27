import { useState, useEffect, useCallback } from 'react';
import PocketBase from 'pocketbase';

const PB_URL = import.meta.env.VITE_POCKETBASE_URL || 'http://localhost:8090';

export const pb = new PocketBase(PB_URL);

export function useAuth() {
    const [user, setUser] = useState<
        Record<string, unknown> | undefined | null
    >(undefined);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Initial check
        const record = pb.authStore.record;
        setUser(record ? (record as Record<string, unknown>) : null);
        setLoading(false);

        // Subscribe to future changes
        const unsubscribe = pb.authStore.onChange((_token, record) => {
            setUser(record ? (record as Record<string, unknown>) : null);
        });

        return unsubscribe;
    }, []);

    const login = useCallback(
        async (email: string, password: string): Promise<void> => {
            try {
                await pb.collection('users').authWithPassword(email, password);
            } catch (e: unknown) {
                throw typeof e === 'object' && e !== null && 'message' in e
                    ? (e as { message: string }).message
                    : 'Login failed';
            }
        },
        []
    );

    const logout = useCallback((): void => {
        pb.authStore.clear();
    }, []);

    const register = useCallback(
        async (
            email: string,
            password: string,
            passwordConfirm: string
        ): Promise<void> => {
            try {
                await pb
                    .collection('users')
                    .create({ email, password, passwordConfirm });
                await pb.collection('users').authWithPassword(email, password);
            } catch (e: unknown) {
                throw typeof e === 'object' && e !== null && 'message' in e
                    ? (e as { message: string }).message
                    : 'Registration failed';
            }
        },
        []
    );

    return {
        user,
        isLoggedIn: !!user,
        loading,
        login,
        logout,
        register,
    } as const;
}
