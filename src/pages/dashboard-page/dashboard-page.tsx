import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useStorage } from '@/hooks/use-storage';
import { Button } from '@/components/button/button';
import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
} from '@/components/card/card';
import type { Diagram } from '@/lib/domain/diagram';

export function DashboardPage() {
    const { isLoggedIn } = useAuth();
    const { listDiagrams, deleteDiagram } = useStorage();
    const navigate = useNavigate();
    const [diagrams, setDiagrams] = useState<Diagram[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = () => {
        setLoading(true);
        setError(null);
        listDiagrams()
            .then(setDiagrams)
            .catch((e) =>
                setError(
                    e instanceof Error ? e.message : 'Failed to load diagrams'
                )
            )
            .finally(() => setLoading(false));
    };

    const loadRef = useRef(load);
    loadRef.current = load;

    useEffect(() => {
        loadRef.current();
    }, []);

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Delete "${name}"?`)) return;
        try {
            await deleteDiagram(id);
            setDiagrams((prev) => prev.filter((d) => d.id !== id));
        } catch {
            alert('Failed to delete diagram');
        }
    };

    if (loading) {
        return (
            <div className="p-8 text-center text-muted-foreground">
                Loading...
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 text-center">
                <p className="mb-4 text-destructive">{error}</p>
                <Button onClick={load}>Retry</Button>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-4xl space-y-6 p-8">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Dashboard</h1>
                <Button onClick={() => navigate('/')}>New Diagram</Button>
            </div>

            {!isLoggedIn && (
                <p className="text-sm text-muted-foreground">
                    Login to sync your diagrams across devices.{' '}
                    <a href="/login" className="ml-1 underline">
                        Login
                    </a>
                </p>
            )}

            {diagrams.length === 0 ? (
                <p className="py-12 text-center text-muted-foreground">
                    No diagrams yet. Create one!
                </p>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {diagrams.map((d) => (
                        <Card
                            key={d.id}
                            className="cursor-pointer"
                            onClick={() => navigate(`/diagrams/${d.id}`)}
                        >
                            <CardHeader>
                                <CardTitle className="truncate">
                                    {d.name}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-xs text-muted-foreground">
                                    Updated{' '}
                                    {new Date(d.updatedAt).toLocaleDateString()}
                                </p>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    className="mt-2"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(d.id, d.name);
                                    }}
                                >
                                    Delete
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
