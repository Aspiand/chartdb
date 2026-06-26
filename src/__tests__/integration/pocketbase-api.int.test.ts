/**
 * API Integration Tests — requires running PocketBase instance.
 *
 * Run: RUN_INTEGRATION=true npx vitest run
 * Requires: docker compose up -d pocketbase
 */

import { describe, it, expect } from 'vitest';

const RUN_INTEGRATION = process.env.RUN_INTEGRATION === 'true';
const PB_URL = process.env.VITE_POCKETBASE_URL || 'http://localhost:8090';

type FetchOptions = {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
};

const api = async (path: string, options: FetchOptions = {}) => {
    const res = await fetch(`${PB_URL}${path}`, {
        method: options.method || 'GET',
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
        body: options.body,
    });
    return {
        ok: res.ok,
        status: res.status,
        data: await res.json().catch(() => null),
    };
};

describe.runIf(RUN_INTEGRATION)('PocketBase API Integration', () => {
    const email = `int-test-${Date.now()}@test.com`;
    let authToken = '';
    let diagramId = '';
    let userId = '';

    describe('Auth', () => {
        it('should register a new user', async () => {
            const { ok, data } = await api('/api/collections/users/records', {
                method: 'POST',
                body: JSON.stringify({
                    email,
                    password: 'TestPass123!',
                    passwordConfirm: 'TestPass123!',
                }),
            });
            expect(ok).toBe(true);
            expect(data.record?.email).toBe(email);
            userId = data.record?.id;
        });

        it('should authenticate with password', async () => {
            const { ok, data } = await api(
                '/api/collections/users/auth-with-password',
                {
                    method: 'POST',
                    body: JSON.stringify({
                        identity: email,
                        password: 'TestPass123!',
                    }),
                }
            );
            expect(ok).toBe(true);
            expect(data.token).toBeDefined();
            authToken = data.token;
        });
    });

    describe('Diagrams CRUD', () => {
        it('should create a diagram', async () => {
            const { ok, data } = await api(
                '/api/collections/diagrams/records',
                {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${authToken}` },
                    body: JSON.stringify({
                        name: 'Test Diagram',
                        owner: userId,
                        data: JSON.stringify({ tables: [], relationships: [] }),
                    }),
                }
            );
            expect(ok).toBe(true);
            expect(data.name).toBe('Test Diagram');
            diagramId = data.id;
        });

        it('should list diagrams', async () => {
            const { ok, data } = await api(
                '/api/collections/diagrams/records',
                {
                    headers: { Authorization: `Bearer ${authToken}` },
                }
            );
            expect(ok).toBe(true);
            expect(data.items.length).toBeGreaterThanOrEqual(1);
        });

        it('should get a diagram by ID', async () => {
            const { ok, data } = await api(
                `/api/collections/diagrams/records/${diagramId}`,
                { headers: { Authorization: `Bearer ${authToken}` } }
            );
            expect(ok).toBe(true);
            expect(data.id).toBe(diagramId);
        });

        it('should update a diagram', async () => {
            const { ok, data } = await api(
                `/api/collections/diagrams/records/${diagramId}`,
                {
                    method: 'PATCH',
                    headers: { Authorization: `Bearer ${authToken}` },
                    body: JSON.stringify({ name: 'Updated Diagram' }),
                }
            );
            expect(ok).toBe(true);
            expect(data.name).toBe('Updated Diagram');
        });

        it('should delete a diagram', async () => {
            const { ok } = await api(
                `/api/collections/diagrams/records/${diagramId}`,
                {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${authToken}` },
                }
            );
            expect(ok).toBe(true);
        });
    });

    describe('Auth rules', () => {
        it('should reject unauthenticated diagram creation', async () => {
            const { ok } = await api('/api/collections/diagrams/records', {
                method: 'POST',
                body: JSON.stringify({ name: 'Unauthorized' }),
            });
            expect(ok).toBe(false);
        });

        it('should allow guest to view public diagram', async () => {
            // Create public diagram first
            const createRes = await api('/api/collections/diagrams/records', {
                method: 'POST',
                headers: { Authorization: `Bearer ${authToken}` },
                body: JSON.stringify({
                    name: 'Public Diagram',
                    is_public: true,
                }),
            });

            // Guest views it
            const { ok, data } = await api(
                `/api/collections/diagrams/records/${createRes.data.id}`
            );
            expect(ok).toBe(true);
            expect(data.name).toBe('Public Diagram');
        });
    });
});
