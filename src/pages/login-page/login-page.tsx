import React, { useState } from 'react';
import { useAuth } from '@/lib/auth';
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
    CardFooter,
} from '@/components/card/card';
import { Input } from '@/components/input/input';
import { Button } from '@/components/button/button';

export function LoginPage() {
    const { login, register, loading } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirm, setPasswordConfirm] = useState('');
    const [error, setError] = useState('');
    const [isRegister, setIsRegister] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (isRegister && password !== passwordConfirm) {
            setError('Passwords do not match');
            return;
        }

        try {
            if (isRegister) {
                await register(email, password, passwordConfirm);
            } else {
                await login(email, password);
            }
            window.location.href = '/';
        } catch (err: unknown) {
            const message =
                err && typeof err === 'object' && 'message' in err
                    ? (err as { message: string }).message
                    : 'Something went wrong';
            setError(message);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
            <Card className="w-full max-w-sm">
                <CardHeader className="text-center">
                    <CardTitle>
                        {isRegister ? 'Create account' : 'Sign in'}
                    </CardTitle>
                    <CardDescription>
                        {isRegister
                            ? 'Enter your details to get started'
                            : 'Enter your email and password to continue'}
                    </CardDescription>
                </CardHeader>

                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-4">
                        <Input
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                        <Input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                        {isRegister && (
                            <Input
                                type="password"
                                placeholder="Confirm password"
                                value={passwordConfirm}
                                onChange={(e) =>
                                    setPasswordConfirm(e.target.value)
                                }
                                required
                            />
                        )}
                        {error && (
                            <p className="text-sm text-red-500">{error}</p>
                        )}
                    </CardContent>

                    <CardFooter className="flex flex-col gap-3">
                        <Button
                            type="submit"
                            className="w-full"
                            disabled={loading}
                        >
                            {loading
                                ? 'Please wait…'
                                : isRegister
                                  ? 'Create account'
                                  : 'Sign in'}
                        </Button>
                        <p className="text-sm text-muted-foreground">
                            {isRegister
                                ? 'Already have an account?'
                                : "Don't have an account?"}{' '}
                            <button
                                type="button"
                                className="font-medium text-primary underline-offset-4 hover:underline"
                                onClick={() => {
                                    setIsRegister(!isRegister);
                                    setError('');
                                }}
                            >
                                {isRegister ? 'Sign in' : 'Register'}
                            </button>
                        </p>
                        <a
                            href="/"
                            className="text-sm text-muted-foreground hover:underline"
                        >
                            Back to home
                        </a>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
