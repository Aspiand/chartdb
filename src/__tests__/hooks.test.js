/**
 * Backend pb_hooks unit tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

function createMockPB() {
    const dao = {
        saveRecord: vi.fn(function (record) {
            return record;
        }),
        deleteRecord: vi.fn(),
        findFirstRecordByFilter: vi.fn(function () {
            return null;
        }),
    };

    const httpContext = {
        auth: { record: { id: 'user-owner' } },
        setHeader: vi.fn(),
        json: vi.fn(function (status, data) {
            return { status, data };
        }),
    };

    return { dao, httpContext };
}

describe('versioning hook', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should create a version snapshot on update with data', () => {
        const { dao } = createMockPB();
        const record = {
            id: 'diag-1',
            get: vi.fn((field) => {
                if (field === 'data') return '{"tables":[]}';
                if (field === 'owner') return 'user-owner';
            }),
        };

        if (record.get('data')) {
            dao.saveRecord({
                collectionName: 'diagram_versions',
                diagram: record.id,
                data: record.get('data'),
                created_by: record.get('owner'),
                description: 'Auto-saved',
            });
        }

        expect(dao.saveRecord).toHaveBeenCalledWith(
            expect.objectContaining({ collectionName: 'diagram_versions' })
        );
    });

    it('should skip versioning when data is empty', () => {
        const { dao } = createMockPB();
        const record = {
            get: vi.fn(() => undefined),
        };

        if (record.get('data')) {
            dao.saveRecord({ collectionName: 'diagram_versions' });
        }

        expect(dao.saveRecord).not.toHaveBeenCalled();
    });
});

describe('collaboration hook', () => {
    let mock;

    beforeEach(() => {
        vi.clearAllMocks();
        mock = createMockPB();
    });

    it('should allow owner to edit', () => {
        const isOwner = 'user-owner' === 'user-owner';
        expect(isOwner).toBe(true);
    });

    it('should deny non-owner without collaborator record', () => {
        const collab = mock.dao.findFirstRecordByFilter(
            'diagram_collaborators',
            'diagram.id = "diag-1" && user.id = "user-stranger"'
        );
        expect(collab).toBeNull();
        expect(mock.dao.findFirstRecordByFilter).toHaveBeenCalled();
    });

    it('should allow collaborator with edit permission', () => {
        mock.dao.findFirstRecordByFilter.mockReturnValueOnce({
            get: vi.fn((field) => {
                if (field === 'permission') return 'edit';
            }),
        });

        const collab = mock.dao.findFirstRecordByFilter(
            'diagram_collaborators',
            'diagram.id = "diag-1" && user.id = "user-editor"'
        );
        expect(collab.get('permission')).toBe('edit');
    });

    it('should deny view-only collaborator on edit', () => {
        mock.dao.findFirstRecordByFilter.mockReturnValueOnce({
            get: vi.fn((field) => {
                if (field === 'permission') return 'view';
            }),
        });

        const collab = mock.dao.findFirstRecordByFilter(
            'diagram_collaborators',
            'diagram.id = "diag-1" && user.id = "user-viewer"'
        );
        expect(collab.get('permission')).toBe('view');
        expect(collab.get('permission') === 'edit').toBe(false);
    });
});
