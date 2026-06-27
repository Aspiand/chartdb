import React, { useCallback, useMemo } from 'react';
import type { StorageContext } from './storage-context';
import { storageContext } from './storage-context';
import PocketBase from 'pocketbase';
import type { Diagram } from '@/lib/domain/diagram';
import type { DBTable } from '@/lib/domain/db-table';
import type { DBRelationship } from '@/lib/domain/db-relationship';
import type { ChartDBConfig } from '@/lib/domain/config';
import type { DBDependency } from '@/lib/domain/db-dependency';
import type { Area } from '@/lib/domain/area';
import type { DBCustomType } from '@/lib/domain/db-custom-type';
import type { DiagramFilter } from '@/lib/domain/diagram-filter/diagram-filter';
import type { Note } from '@/lib/domain/note';

// Fallback to local Dexie when offline
import Dexie from 'dexie';
import type { EntityTable } from 'dexie';

const PB_URL = import.meta.env.VITE_POCKETBASE_URL || 'http://localhost:8090';

export const PocketBaseProvider: React.FC<React.PropsWithChildren> = ({
    children,
}) => {
    const pb = useMemo(() => new PocketBase(PB_URL), []);

    // Local Dexie DB as fallback when offline
    const localDb = useMemo(() => {
        const db = new Dexie('ChartDB_Local') as Dexie & {
            diagrams: EntityTable<Diagram, 'id'>;
            db_tables: EntityTable<DBTable & { diagramId: string }, 'id'>;
            db_relationships: EntityTable<
                DBRelationship & { diagramId: string },
                'id'
            >;
            db_dependencies: EntityTable<
                DBDependency & { diagramId: string },
                'id'
            >;
            areas: EntityTable<Area & { diagramId: string }, 'id'>;
            db_custom_types: EntityTable<
                DBCustomType & { diagramId: string },
                'id'
            >;
            notes: EntityTable<Note & { diagramId: string }, 'id'>;
            config: EntityTable<ChartDBConfig & { id: number }, 'id'>;
            diagram_filters: EntityTable<
                DiagramFilter & { diagramId: string },
                'diagramId'
            >;
        };
        db.version(1).stores({
            diagrams: 'id, name, createdAt, updatedAt',
            db_tables: 'id, diagramId, name',
            db_relationships: 'id, diagramId, name',
            db_dependencies: 'id, diagramId',
            areas: 'id, diagramId',
            db_custom_types: 'id, diagramId',
            notes: 'id, diagramId',
            config: 'id',
            diagram_filters: 'diagramId',
        });
        return db;
    }, []);

    const isOnline = useCallback(() => navigator.onLine, []);

    // ── Helper: online → PB, offline → Dexie ──────────────────
    const withFallback = useCallback(
        async <T,>(
            onlineOp: () => Promise<T>,
            offlineOp: () => Promise<T>
        ): Promise<T> => {
            if (isOnline()) {
                try {
                    return await onlineOp();
                } catch {
                    // PB unreachable → fall through to offline
                }
            }
            return await offlineOp();
        },
        [isOnline]
    );

    // ── Config ───────────────────────────────────────────────
    const getConfig = useCallback(async (): Promise<
        ChartDBConfig | undefined
    > => {
        return withFallback(
            async () => {
                try {
                    const records = await pb.collection('config').getList(1, 1);
                    return records.items[0] as unknown as ChartDBConfig;
                } catch {
                    return undefined;
                }
            },
            async () => {
                return (await localDb.config.toArray())[0] as
                    | ChartDBConfig
                    | undefined;
            }
        );
    }, [pb, localDb, withFallback]);

    const updateConfig = useCallback(
        async (config: Partial<ChartDBConfig>): Promise<void> => {
            return withFallback(
                async () => {
                    const existing = await pb
                        .collection('config')
                        .getList(1, 1);
                    if (existing.items.length > 0) {
                        await pb
                            .collection('config')
                            .update(existing.items[0].id, config);
                    } else {
                        await pb.collection('config').create(config);
                    }
                },
                async () => {
                    const existing = await localDb.config.toArray();
                    if (existing.length > 0) {
                        await localDb.config.update(existing[0].id!, config);
                    } else {
                        await localDb.config.add({
                            ...config,
                            id: 1,
                        } as unknown as ChartDBConfig & { id: number });
                    }
                }
            );
        },
        [pb, localDb, withFallback]
    );

    // ── Diagram filter ───────────────────────────────────────
    const getDiagramFilter = useCallback(
        async (diagramId: string): Promise<DiagramFilter | undefined> => {
            return withFallback(
                async () => {
                    try {
                        return (await pb
                            .collection('diagram_filters')
                            .getFirstListItem(
                                `diagramId="${diagramId}"`
                            )) as unknown as DiagramFilter;
                    } catch {
                        return undefined;
                    }
                },
                async () => localDb.diagram_filters.get(diagramId)
            );
        },
        [pb, localDb, withFallback]
    );

    const updateDiagramFilter = useCallback(
        async (diagramId: string, filter: DiagramFilter): Promise<void> => {
            return withFallback(
                async () => {
                    try {
                        const existing = await pb
                            .collection('diagram_filters')
                            .getFirstListItem(`diagramId="${diagramId}"`);
                        await pb
                            .collection('diagram_filters')
                            .update(existing.id, filter);
                    } catch {
                        await pb
                            .collection('diagram_filters')
                            .create({ diagramId, ...filter });
                    }
                },
                async () => {
                    await localDb.diagram_filters.put({ ...filter, diagramId });
                }
            );
        },
        [pb, localDb, withFallback]
    );

    const deleteDiagramFilter = useCallback(
        async (diagramId: string): Promise<void> => {
            return withFallback(
                async () => {
                    try {
                        const existing = await pb
                            .collection('diagram_filters')
                            .getFirstListItem(`diagramId="${diagramId}"`);
                        await pb
                            .collection('diagram_filters')
                            .delete(existing.id);
                    } catch {
                        /* not found */
                    }
                },
                async () => localDb.diagram_filters.delete(diagramId)
            );
        },
        [pb, localDb, withFallback]
    );

    // ── Diagram CRUD ─────────────────────────────────────────
    const addDiagram = useCallback(
        async (params: { diagram: Diagram }): Promise<void> => {
            return withFallback(
                async () => {
                    await pb.collection('diagrams').create({
                        ...params.diagram,
                        owner: pb.authStore.record?.id,
                    });
                },
                async () => {
                    await localDb.diagrams.add(params.diagram);
                }
            );
        },
        [pb, localDb, withFallback]
    );

    const listDiagrams = useCallback(
        async (options?: {
            includeTables?: boolean;
            includeRelationships?: boolean;
            includeDependencies?: boolean;
            includeAreas?: boolean;
            includeCustomTypes?: boolean;
            includeNotes?: boolean;
        }): Promise<Diagram[]> => {
            return withFallback(
                async () => {
                    const records = await pb
                        .collection('diagrams')
                        .getFullList({
                            sort: '-created',
                            expand: options
                                ? Object.entries(options)
                                      .filter(([, v]) => v)
                                      .map(([k]) => k)
                                      .join(',')
                                : undefined,
                        });
                    return records.map((r: Record<string, unknown>) => {
                        const diagram = r as unknown as Diagram;
                        const expandable = r as unknown as {
                            expand?: Record<string, unknown>;
                        };
                        if (expandable.expand?.tables)
                            diagram.tables = expandable.expand
                                .tables as DBTable[];
                        return diagram;
                    });
                },
                async () => localDb.diagrams.toArray()
            );
        },
        [pb, localDb, withFallback]
    );

    const getDiagram = useCallback(
        async (
            id: string,
            options?: {
                includeTables?: boolean;
                includeRelationships?: boolean;
                includeDependencies?: boolean;
                includeAreas?: boolean;
                includeCustomTypes?: boolean;
                includeNotes?: boolean;
            }
        ): Promise<Diagram | undefined> => {
            return withFallback(
                async () => {
                    try {
                        const record = await pb
                            .collection('diagrams')
                            .getOne(id, {
                                expand: options
                                    ? Object.entries(options)
                                          .filter(([, v]) => v)
                                          .map(([k]) => k)
                                          .join(',')
                                    : undefined,
                            });
                        return record as unknown as Diagram;
                    } catch {
                        return undefined;
                    }
                },
                async () => localDb.diagrams.get(id)
            );
        },
        [pb, localDb, withFallback]
    );

    const updateDiagram = useCallback(
        async (params: {
            id: string;
            attributes: Partial<Diagram>;
        }): Promise<void> => {
            return withFallback(
                async () => {
                    await pb
                        .collection('diagrams')
                        .update(params.id, params.attributes);
                },
                async () => {
                    await localDb.diagrams.update(params.id, params.attributes);
                }
            );
        },
        [pb, localDb, withFallback]
    );

    const deleteDiagram = useCallback(
        async (id: string): Promise<void> => {
            return withFallback(
                async () => {
                    await pb.collection('diagrams').delete(id);
                },
                async () => {
                    await localDb.diagrams.delete(id);
                }
            );
        },
        [pb, localDb, withFallback]
    );

    // ── Table CRUD ───────────────────────────────────────────
    const addTable = useCallback(
        async (params: {
            diagramId: string;
            table: DBTable;
        }): Promise<void> => {
            return withFallback(
                async () => {
                    await pb.collection('db_tables').create({
                        ...params.table,
                        diagramId: params.diagramId,
                    });
                },
                async () => {
                    await localDb.db_tables.add({
                        ...params.table,
                        diagramId: params.diagramId,
                    });
                }
            );
        },
        [pb, localDb, withFallback]
    );

    const getTable = useCallback(
        async (params: {
            diagramId: string;
            id: string;
        }): Promise<DBTable | undefined> => {
            return withFallback(
                async () => {
                    try {
                        const record = await pb
                            .collection('db_tables')
                            .getOne(params.id);
                        return record as unknown as DBTable;
                    } catch {
                        return undefined;
                    }
                },
                async () => localDb.db_tables.get(params.id)
            );
        },
        [pb, localDb, withFallback]
    );

    const updateTable = useCallback(
        async (params: {
            id: string;
            attributes: Partial<DBTable>;
        }): Promise<void> => {
            return withFallback(
                async () => {
                    await pb
                        .collection('db_tables')
                        .update(params.id, params.attributes);
                },
                async () => {
                    await localDb.db_tables.update(
                        params.id,
                        params.attributes
                    );
                }
            );
        },
        [pb, localDb, withFallback]
    );

    const putTable = useCallback(
        async (params: {
            diagramId: string;
            table: DBTable;
        }): Promise<void> => {
            return withFallback(
                async () => {
                    await pb.collection('db_tables').create({
                        ...params.table,
                        diagramId: params.diagramId,
                    });
                },
                async () => {
                    await localDb.db_tables.put({
                        ...params.table,
                        diagramId: params.diagramId,
                    });
                }
            );
        },
        [pb, localDb, withFallback]
    );

    const deleteTable = useCallback(
        async (params: { diagramId: string; id: string }): Promise<void> => {
            return withFallback(
                async () => {
                    await pb.collection('db_tables').delete(params.id);
                },
                async () => {
                    await localDb.db_tables.delete(params.id);
                }
            );
        },
        [pb, localDb, withFallback]
    );

    const listTables = useCallback(
        async (diagramId: string): Promise<DBTable[]> => {
            return withFallback(
                async () => {
                    const records = await pb
                        .collection('db_tables')
                        .getFullList({ filter: `diagramId="${diagramId}"` });
                    return records.map(
                        (r: Record<string, unknown>) => r as unknown as DBTable
                    );
                },
                async () =>
                    localDb.db_tables
                        .where('diagramId')
                        .equals(diagramId)
                        .toArray()
            );
        },
        [pb, localDb, withFallback]
    );

    const deleteDiagramTables = useCallback(
        async (diagramId: string): Promise<void> => {
            return withFallback(
                async () => {
                    const records = await pb
                        .collection('db_tables')
                        .getFullList({ filter: `diagramId="${diagramId}"` });
                    for (const r of records) {
                        await pb.collection('db_tables').delete(r.id);
                    }
                },
                async () => {
                    await localDb.db_tables
                        .where('diagramId')
                        .equals(diagramId)
                        .delete();
                }
            );
        },
        [pb, localDb, withFallback]
    );

    // ── Stubs for remaining StorageContext methods ────────────
    // These follow the same pattern: online → PB, offline → Dexie
    // Full implementation will be done after schema alignment

    const addRelationship = useCallback(
        async (params: {
            diagramId: string;
            relationship: DBRelationship;
        }): Promise<void> => {
            return withFallback(
                async () => {
                    await pb.collection('db_relationships').create({
                        ...params.relationship,
                        diagramId: params.diagramId,
                    });
                },
                async () => {
                    await localDb.db_relationships.add({
                        ...params.relationship,
                        diagramId: params.diagramId,
                    });
                }
            );
        },
        [pb, localDb, withFallback]
    );

    const getRelationship = useCallback(
        async (params: {
            diagramId: string;
            id: string;
        }): Promise<DBRelationship | undefined> => {
            return withFallback(
                async () => {
                    try {
                        return (await pb
                            .collection('db_relationships')
                            .getOne(params.id)) as unknown as DBRelationship;
                    } catch {
                        return undefined;
                    }
                },
                async () => localDb.db_relationships.get(params.id)
            );
        },
        [pb, localDb, withFallback]
    );

    const updateRelationship = useCallback(
        async (params: {
            id: string;
            attributes: Partial<DBRelationship>;
        }): Promise<void> => {
            return withFallback(
                async () => {
                    await pb
                        .collection('db_relationships')
                        .update(params.id, params.attributes);
                },
                async () => {
                    await localDb.db_relationships.update(
                        params.id,
                        params.attributes
                    );
                }
            );
        },
        [pb, localDb, withFallback]
    );

    const deleteRelationship = useCallback(
        async (params: { diagramId: string; id: string }): Promise<void> => {
            return withFallback(
                async () => {
                    await pb.collection('db_relationships').delete(params.id);
                },
                async () => {
                    await localDb.db_relationships.delete(params.id);
                }
            );
        },
        [pb, localDb, withFallback]
    );

    const listRelationships = useCallback(
        async (diagramId: string): Promise<DBRelationship[]> => {
            return withFallback(
                async () => {
                    const records = await pb
                        .collection('db_relationships')
                        .getFullList({ filter: `diagramId="${diagramId}"` });
                    return records.map(
                        (r: Record<string, unknown>) =>
                            r as unknown as DBRelationship
                    );
                },
                async () =>
                    localDb.db_relationships
                        .where('diagramId')
                        .equals(diagramId)
                        .toArray()
            );
        },
        [pb, localDb, withFallback]
    );

    const deleteDiagramRelationships = useCallback(
        async (diagramId: string): Promise<void> => {
            return withFallback(
                async () => {
                    const records = await pb
                        .collection('db_relationships')
                        .getFullList({ filter: `diagramId="${diagramId}"` });
                    for (const r of records) {
                        await pb.collection('db_relationships').delete(r.id);
                    }
                },
                async () => {
                    await localDb.db_relationships
                        .where('diagramId')
                        .equals(diagramId)
                        .delete();
                }
            );
        },
        [pb, localDb, withFallback]
    );

    // ── Dependencies (stubs) ─────────────────────────────────
    const addDependency = useCallback(
        async (params: {
            diagramId: string;
            dependency: DBDependency;
        }): Promise<void> => {
            void params;
            return withFallback(
                async () => {},
                async () => {}
            );
        },
        [withFallback]
    );

    const getDependency = useCallback(
        async (params: {
            diagramId: string;
            id: string;
        }): Promise<DBDependency | undefined> => {
            return withFallback(
                async () => {
                    try {
                        return (await pb
                            .collection('db_dependencies')
                            .getOne(params.id)) as unknown as DBDependency;
                    } catch {
                        return undefined;
                    }
                },
                async () => localDb.db_dependencies.get(params.id)
            );
        },
        [pb, localDb, withFallback]
    );

    const updateDependency = useCallback(
        async (params: {
            id: string;
            attributes: Partial<DBDependency>;
        }): Promise<void> => {
            return withFallback(
                async () => {
                    await pb
                        .collection('db_dependencies')
                        .update(params.id, params.attributes);
                },
                async () => {
                    await localDb.db_dependencies.update(
                        params.id,
                        params.attributes
                    );
                }
            );
        },
        [pb, localDb, withFallback]
    );

    const deleteDependency = useCallback(
        async (params: { diagramId: string; id: string }): Promise<void> => {
            return withFallback(
                async () => {
                    await pb.collection('db_dependencies').delete(params.id);
                },
                async () => {
                    await localDb.db_dependencies.delete(params.id);
                }
            );
        },
        [pb, localDb, withFallback]
    );

    const listDependencies = useCallback(
        async (diagramId: string): Promise<DBDependency[]> => {
            return withFallback(
                async () => {
                    const records = await pb
                        .collection('db_dependencies')
                        .getFullList({ filter: `diagramId="${diagramId}"` });
                    return records.map(
                        (r: Record<string, unknown>) =>
                            r as unknown as DBDependency
                    );
                },
                async () =>
                    localDb.db_dependencies
                        .where('diagramId')
                        .equals(diagramId)
                        .toArray()
            );
        },
        [pb, localDb, withFallback]
    );

    const deleteDiagramDependencies = useCallback(
        async (diagramId: string): Promise<void> => {
            return withFallback(
                async () => {
                    const records = await pb
                        .collection('db_dependencies')
                        .getFullList({ filter: `diagramId="${diagramId}"` });
                    for (const r of records) {
                        await pb.collection('db_dependencies').delete(r.id);
                    }
                },
                async () => {
                    await localDb.db_dependencies
                        .where('diagramId')
                        .equals(diagramId)
                        .delete();
                }
            );
        },
        [pb, localDb, withFallback]
    );

    // ── Areas (stubs) ───────────────────────────────────────
    const addArea = useCallback(
        async (params: { diagramId: string; area: Area }): Promise<void> => {
            return withFallback(
                async () => {
                    await pb.collection('areas').create({
                        ...params.area,
                        diagramId: params.diagramId,
                    });
                },
                async () => {
                    await localDb.areas.add({
                        ...params.area,
                        diagramId: params.diagramId,
                    });
                }
            );
        },
        [pb, localDb, withFallback]
    );

    const getArea = useCallback(
        async (params: {
            diagramId: string;
            id: string;
        }): Promise<Area | undefined> => {
            return withFallback(
                async () => {
                    try {
                        return (await pb
                            .collection('areas')
                            .getOne(params.id)) as unknown as Area;
                    } catch {
                        return undefined;
                    }
                },
                async () => localDb.areas.get(params.id)
            );
        },
        [pb, localDb, withFallback]
    );

    const updateArea = useCallback(
        async (params: {
            id: string;
            attributes: Partial<Area>;
        }): Promise<void> => {
            return withFallback(
                async () => {
                    await pb
                        .collection('areas')
                        .update(params.id, params.attributes);
                },
                async () => {
                    await localDb.areas.update(params.id, params.attributes);
                }
            );
        },
        [pb, localDb, withFallback]
    );

    const deleteArea = useCallback(
        async (params: { diagramId: string; id: string }): Promise<void> => {
            return withFallback(
                async () => {
                    await pb.collection('areas').delete(params.id);
                },
                async () => {
                    await localDb.areas.delete(params.id);
                }
            );
        },
        [pb, localDb, withFallback]
    );

    const listAreas = useCallback(
        async (diagramId: string): Promise<Area[]> => {
            return withFallback(
                async () => {
                    const records = await pb
                        .collection('areas')
                        .getFullList({ filter: `diagramId="${diagramId}"` });
                    return records.map(
                        (r: Record<string, unknown>) => r as unknown as Area
                    );
                },
                async () =>
                    localDb.areas.where('diagramId').equals(diagramId).toArray()
            );
        },
        [pb, localDb, withFallback]
    );

    const deleteDiagramAreas = useCallback(
        async (diagramId: string): Promise<void> => {
            return withFallback(
                async () => {
                    const records = await pb
                        .collection('areas')
                        .getFullList({ filter: `diagramId="${diagramId}"` });
                    for (const r of records) {
                        await pb.collection('areas').delete(r.id);
                    }
                },
                async () => {
                    await localDb.areas
                        .where('diagramId')
                        .equals(diagramId)
                        .delete();
                }
            );
        },
        [pb, localDb, withFallback]
    );

    // ── Custom Types (stubs) ─────────────────────────────────
    const addCustomType = useCallback(
        async (params: {
            diagramId: string;
            customType: DBCustomType;
        }): Promise<void> => {
            return withFallback(
                async () => {
                    await pb.collection('db_custom_types').create({
                        ...params.customType,
                        diagramId: params.diagramId,
                    });
                },
                async () => {
                    await localDb.db_custom_types.add({
                        ...params.customType,
                        diagramId: params.diagramId,
                    });
                }
            );
        },
        [pb, localDb, withFallback]
    );

    const getCustomType = useCallback(
        async (params: {
            diagramId: string;
            id: string;
        }): Promise<DBCustomType | undefined> => {
            return withFallback(
                async () => {
                    try {
                        return (await pb
                            .collection('db_custom_types')
                            .getOne(params.id)) as unknown as DBCustomType;
                    } catch {
                        return undefined;
                    }
                },
                async () => localDb.db_custom_types.get(params.id)
            );
        },
        [pb, localDb, withFallback]
    );

    const updateCustomType = useCallback(
        async (params: {
            id: string;
            attributes: Partial<DBCustomType>;
        }): Promise<void> => {
            return withFallback(
                async () => {
                    await pb
                        .collection('db_custom_types')
                        .update(params.id, params.attributes);
                },
                async () => {
                    await localDb.db_custom_types.update(
                        params.id,
                        params.attributes
                    );
                }
            );
        },
        [pb, localDb, withFallback]
    );

    const deleteCustomType = useCallback(
        async (params: { diagramId: string; id: string }): Promise<void> => {
            return withFallback(
                async () => {
                    await pb.collection('db_custom_types').delete(params.id);
                },
                async () => {
                    await localDb.db_custom_types.delete(params.id);
                }
            );
        },
        [pb, localDb, withFallback]
    );

    const listCustomTypes = useCallback(
        async (diagramId: string): Promise<DBCustomType[]> => {
            return withFallback(
                async () => {
                    const records = await pb
                        .collection('db_custom_types')
                        .getFullList({ filter: `diagramId="${diagramId}"` });
                    return records.map(
                        (r: Record<string, unknown>) =>
                            r as unknown as DBCustomType
                    );
                },
                async () =>
                    localDb.db_custom_types
                        .where('diagramId')
                        .equals(diagramId)
                        .toArray()
            );
        },
        [pb, localDb, withFallback]
    );

    const deleteDiagramCustomTypes = useCallback(
        async (diagramId: string): Promise<void> => {
            return withFallback(
                async () => {
                    const records = await pb
                        .collection('db_custom_types')
                        .getFullList({ filter: `diagramId="${diagramId}"` });
                    for (const r of records) {
                        await pb.collection('db_custom_types').delete(r.id);
                    }
                },
                async () => {
                    await localDb.db_custom_types
                        .where('diagramId')
                        .equals(diagramId)
                        .delete();
                }
            );
        },
        [pb, localDb, withFallback]
    );

    // ── Notes (stubs) ────────────────────────────────────────
    const addNote = useCallback(
        async (params: { diagramId: string; note: Note }): Promise<void> => {
            return withFallback(
                async () => {
                    await pb.collection('notes').create({
                        ...params.note,
                        diagramId: params.diagramId,
                    });
                },
                async () => {
                    await localDb.notes.add({
                        ...params.note,
                        diagramId: params.diagramId,
                    });
                }
            );
        },
        [pb, localDb, withFallback]
    );

    const getNote = useCallback(
        async (params: {
            diagramId: string;
            id: string;
        }): Promise<Note | undefined> => {
            return withFallback(
                async () => {
                    try {
                        return (await pb
                            .collection('notes')
                            .getOne(params.id)) as unknown as Note;
                    } catch {
                        return undefined;
                    }
                },
                async () => localDb.notes.get(params.id)
            );
        },
        [pb, localDb, withFallback]
    );

    const updateNote = useCallback(
        async (params: {
            id: string;
            attributes: Partial<Note>;
        }): Promise<void> => {
            return withFallback(
                async () => {
                    await pb
                        .collection('notes')
                        .update(params.id, params.attributes);
                },
                async () => {
                    await localDb.notes.update(params.id, params.attributes);
                }
            );
        },
        [pb, localDb, withFallback]
    );

    const deleteNote = useCallback(
        async (params: { diagramId: string; id: string }): Promise<void> => {
            return withFallback(
                async () => {
                    await pb.collection('notes').delete(params.id);
                },
                async () => {
                    await localDb.notes.delete(params.id);
                }
            );
        },
        [pb, localDb, withFallback]
    );

    const listNotes = useCallback(
        async (diagramId: string): Promise<Note[]> => {
            return withFallback(
                async () => {
                    const records = await pb
                        .collection('notes')
                        .getFullList({ filter: `diagramId="${diagramId}"` });
                    return records.map(
                        (r: Record<string, unknown>) => r as unknown as Note
                    );
                },
                async () =>
                    localDb.notes.where('diagramId').equals(diagramId).toArray()
            );
        },
        [pb, localDb, withFallback]
    );

    const deleteDiagramNotes = useCallback(
        async (diagramId: string): Promise<void> => {
            return withFallback(
                async () => {
                    const records = await pb
                        .collection('notes')
                        .getFullList({ filter: `diagramId="${diagramId}"` });
                    for (const r of records) {
                        await pb.collection('notes').delete(r.id);
                    }
                },
                async () => {
                    await localDb.notes
                        .where('diagramId')
                        .equals(diagramId)
                        .delete();
                }
            );
        },
        [pb, localDb, withFallback]
    );

    // ── Context value ───────────────────────────────────────
    const contextValue: StorageContext = useMemo(
        () => ({
            getConfig,
            updateConfig,
            getDiagramFilter,
            updateDiagramFilter,
            deleteDiagramFilter,
            addDiagram,
            listDiagrams,
            getDiagram,
            updateDiagram,
            deleteDiagram,
            addTable,
            getTable,
            updateTable,
            putTable,
            deleteTable,
            listTables,
            deleteDiagramTables,
            addRelationship,
            getRelationship,
            updateRelationship,
            deleteRelationship,
            listRelationships,
            deleteDiagramRelationships,
            addDependency,
            getDependency,
            updateDependency,
            deleteDependency,
            listDependencies,
            deleteDiagramDependencies,
            addArea,
            getArea,
            updateArea,
            deleteArea,
            listAreas,
            deleteDiagramAreas,
            addCustomType,
            getCustomType,
            updateCustomType,
            deleteCustomType,
            listCustomTypes,
            deleteDiagramCustomTypes,
            addNote,
            getNote,
            updateNote,
            deleteNote,
            listNotes,
            deleteDiagramNotes,
        }),
        [
            getConfig,
            updateConfig,
            getDiagramFilter,
            updateDiagramFilter,
            deleteDiagramFilter,
            addDiagram,
            listDiagrams,
            getDiagram,
            updateDiagram,
            deleteDiagram,
            addTable,
            getTable,
            updateTable,
            putTable,
            deleteTable,
            listTables,
            deleteDiagramTables,
            addRelationship,
            getRelationship,
            updateRelationship,
            deleteRelationship,
            listRelationships,
            deleteDiagramRelationships,
            addDependency,
            getDependency,
            updateDependency,
            deleteDependency,
            listDependencies,
            deleteDiagramDependencies,
            addArea,
            getArea,
            updateArea,
            deleteArea,
            listAreas,
            deleteDiagramAreas,
            addCustomType,
            getCustomType,
            updateCustomType,
            deleteCustomType,
            listCustomTypes,
            deleteDiagramCustomTypes,
            addNote,
            getNote,
            updateNote,
            deleteNote,
            listNotes,
            deleteDiagramNotes,
        ]
    );

    return (
        <storageContext.Provider value={contextValue}>
            {children}
        </storageContext.Provider>
    );
};

export default PocketBaseProvider;
