import React, { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ChartDBLogo from '@/assets/logo-light.png';
import ChartDBDarkLogo from '@/assets/logo-dark.png';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { useEditorPermission } from '@/context/permission-context/permission-context';
import { DiagramName } from './diagram-name';
import { LastSaved } from './last-saved';
import { LanguageNav } from './language-nav/language-nav';
import { Menu } from './menu/menu';

export interface TopNavbarProps {}

export const TopNavbar: React.FC<TopNavbarProps> = () => {
    const { effectiveTheme } = useTheme();
    const { user, isLoggedIn, loading, logout } = useAuth();
    const { canEdit, loading: permLoading } = useEditorPermission();
    const navigate = useNavigate();
    const { diagramId } = useParams<{ diagramId: string }>();
    const [copied, setCopied] = useState(false);

    const renderStars = useCallback(() => {
        return (
            <iframe
                src={`https://ghbtns.com/github-btn.html?user=chartdb&repo=chartdb&type=star&size=large&text=false`}
                width="40"
                height="30"
                title="GitHub"
            ></iframe>
        );
    }, []);

    const handleShare = useCallback(() => {
        if (!diagramId) return;
        const url = `${window.location.origin}/diagrams/${diagramId}`;
        navigator.clipboard.writeText(url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }, [diagramId]);

    return (
        <>
            <nav className="flex flex-col justify-between border-b px-3 md:h-12 md:flex-row md:items-center md:px-4">
                <div className="flex flex-1 flex-col justify-between gap-x-1 md:flex-row md:justify-normal">
                    <div className="flex items-center justify-between pt-[8px] font-primary md:py-[10px]">
                        <a href="/" className="cursor-pointer" rel="noreferrer">
                            <img
                                src={
                                    effectiveTheme === 'light'
                                        ? ChartDBLogo
                                        : ChartDBDarkLogo
                                }
                                alt="mychart"
                                className="h-4 max-w-fit"
                            />
                        </a>
                    </div>
                    <Menu />
                </div>
                <DiagramName />
                <div className="hidden flex-1 items-center justify-end gap-2 sm:flex">
                    <LastSaved />

                    {/* Share button — only when diagram loaded */}
                    {diagramId && isLoggedIn && (
                        <button
                            onClick={handleShare}
                            className="text-xs text-blue-600 hover:text-blue-800"
                        >
                            {copied ? 'Copied!' : 'Share'}
                        </button>
                    )}

                    {renderStars()}

                    {/* Read-only indicator */}
                    {!permLoading && !canEdit && (
                        <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                            Read-only
                        </span>
                    )}

                    {loading ? (
                        <span className="text-xs text-gray-400">...</span>
                    ) : isLoggedIn ? (
                        <>
                            <span className="max-w-[120px] truncate text-xs text-gray-600">
                                {user?.email as string}
                            </span>
                            <button
                                onClick={logout}
                                className="text-xs text-gray-500 hover:text-gray-900"
                            >
                                Logout
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => navigate('/login')}
                            className="text-xs text-blue-600 hover:text-blue-800"
                        >
                            Login
                        </button>
                    )}
                    <LanguageNav />
                </div>
            </nav>

            {/* Read-only banner — full width */}
            {!permLoading && !canEdit && (
                <div className="border-b border-yellow-200 bg-yellow-50 px-4 py-1.5 text-center text-xs text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-300">
                    You are viewing this diagram.&nbsp;
                    <button
                        onClick={() => navigate('/login')}
                        className="font-medium underline"
                    >
                        Login
                    </button>
                    &nbsp;as the owner to edit.
                </div>
            )}
        </>
    );
};
