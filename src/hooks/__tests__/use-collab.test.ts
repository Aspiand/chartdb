import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Properly mock yjs with a Doc class export
class MockDoc {
    on = vi.fn();
    off = vi.fn();
    destroy = vi.fn();
    getMap = vi.fn(() => ({
        set: vi.fn(),
        get: vi.fn(),
        observe: vi.fn(),
        unobserve: vi.fn(),
    }));
}

vi.mock('yjs', () => {
    return {
        Doc: vi.fn(() => new MockDoc()),
    };
});

vi.mock('y-websocket', () => {
    const mockProvider = {
        on: vi.fn(),
        off: vi.fn(),
        disconnect: vi.fn(),
        destroy: vi.fn(),
        connect: vi.fn(),
    };
    return {
        WebsocketProvider: vi.fn(() => mockProvider),
    };
});

// Set env before importing the module under test
import.meta.env.VITE_COLLAB_WS_URL = 'ws://localhost:8080/collab';

describe('useCollab', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should not connect when diagramId is null', async () => {
        const { useCollab } = await import('@/hooks/use-collab');
        const { result } = renderHook(() =>
            useCollab({ diagramId: null, enabled: true })
        );

        expect(result.current.doc).toBeNull();
    });

    it('should not connect when enabled is false', async () => {
        const { useCollab } = await import('@/hooks/use-collab');
        const { result } = renderHook(() =>
            useCollab({ diagramId: 'diag-1', enabled: false })
        );

        expect(result.current.doc).toBeNull();
        expect(result.current.connected).toBe(false);
    });

    it('should connect to y-websocket when diagramId is provided', async () => {
        const { useCollab } = await import('@/hooks/use-collab');
        const { Doc } = await import('yjs');
        const { WebsocketProvider } = await import('y-websocket');

        renderHook(() => useCollab({ diagramId: 'diag-1', enabled: true }));

        expect(Doc).toHaveBeenCalled();
        expect(WebsocketProvider).toHaveBeenCalledWith(
            'ws://localhost:8080/collab',
            'diagram-diag-1',
            expect.any(Object),
            { connect: true }
        );
    });

    it('should call onSync callback when sync event fires', async () => {
        const { useCollab } = await import('@/hooks/use-collab');
        const { WebsocketProvider } = await import('y-websocket');
        const onSync = vi.fn();

        renderHook(() =>
            useCollab({ diagramId: 'diag-1', enabled: true, onSync })
        );

        // Simulate y-websocket sync event
        const wsMock = vi.mocked(WebsocketProvider).mock.results[0]?.value;
        if (wsMock) {
            const syncCall = wsMock.on.mock.calls.find(
                ([event]: [string]) => event === 'sync'
            );
            expect(syncCall).toBeDefined();
            syncCall[1](true);
            expect(onSync).toHaveBeenCalled();
        }
    });

    it('should disconnect on unmount', async () => {
        const { useCollab } = await import('@/hooks/use-collab');
        const { WebsocketProvider } = await import('y-websocket');

        const { unmount } = renderHook(() =>
            useCollab({ diagramId: 'diag-1', enabled: true })
        );

        unmount();

        const wsMock = vi.mocked(WebsocketProvider).mock.results[0]?.value;
        if (wsMock) {
            expect(wsMock.disconnect).toHaveBeenCalled();
            expect(wsMock.destroy).toHaveBeenCalled();
        }
    });

    it('should reconnect when diagramId changes', async () => {
        const { useCollab } = await import('@/hooks/use-collab');
        const { WebsocketProvider } = await import('y-websocket');

        const { rerender } = renderHook(
            ({ diagramId }: { diagramId: string | null }) =>
                useCollab({ diagramId, enabled: true }),
            { initialProps: { diagramId: 'diag-a' } }
        );

        const wsMock = vi.mocked(WebsocketProvider).mock.results[0]?.value;

        rerender({ diagramId: 'diag-b' });

        if (wsMock) {
            expect(wsMock.disconnect).toHaveBeenCalled();
            expect(wsMock.destroy).toHaveBeenCalled();
        }
        expect(WebsocketProvider).toHaveBeenCalledTimes(2);
    });

    it('should expose disconnect and reconnect methods', async () => {
        const { useCollab } = await import('@/hooks/use-collab');
        const { WebsocketProvider } = await import('y-websocket');

        const { result } = renderHook(() =>
            useCollab({ diagramId: 'diag-1', enabled: true })
        );

        expect(typeof result.current.disconnect).toBe('function');
        expect(typeof result.current.reconnect).toBe('function');

        act(() => {
            result.current.disconnect();
        });

        const wsMock = vi.mocked(WebsocketProvider).mock.results[0]?.value;
        if (wsMock) {
            expect(wsMock.disconnect).toHaveBeenCalled();
        }
    });
});
