import React, { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ChartDBLogo from '@/assets/logo-2.png';
import { useAuth } from '@/lib/auth';
import { useEditorPermission } from '@/context/permission-context/permission-context';
import { DiagramName } from './diagram-name';
import { LanguageNav } from './language-nav/language-nav';
import { Menu } from './menu/menu';
import { Button } from '@/components/button/button';
import { useSidebar } from '@/components/sidebar/use-sidebar';
import { MenuIcon } from 'lucide-react';

export interface TopNavbarMobileProps {}

export const TopNavbarMobile: React.FC<TopNavbarMobileProps> = () => {
    const { isLoggedIn, loading, logout } = useAuth();
    const { canEdit, loading: permLoading } = useEditorPermission();
    const navigate = useNavigate();
    const { diagramId } = useParams<{ diagramId: string }>();
    const [copied, setCopied] = useState(false);

    const renderStars = useCallback(() => {
        return (
            <iframe
                src="https://ghbtns.com/github-btn.html?user=chartdb&repo=chartdb&type=star&size=small&text=false"
                width="25"
                height="20"
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

    const { toggleSidebar } = useSidebar();

    return (
        <>
            <nav className="flex flex-col justify-between border-b px-3 md:h-12 md:flex-row md:items-center md:px-4">
                <div className="flex flex-1 flex-col justify-between gap-x-1 md:flex-row md:justify-normal">
                    <div className="flex items-center justify-between pt-[8px] font-primary md:py-[10px]">
                        <div className="flex items-center gap-2">
                            <Button
                                size={'icon'}
                                variant="ghost"
                                onClick={toggleSidebar}
                            >
                                <MenuIcon className="size-5" />
                            </Button>
                            <a
                                href="/"
                                className="cursor-pointer"
                                rel="noreferrer"
                            >
                                <img
                                    src={ChartDBLogo}
                                    alt="mychart"
                                    className="h-4 max-w-fit"
                                />
                            </a>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Read-only indicator */}
                            {!permLoading && !canEdit && (
                                <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-[10px] font-medium text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                                    View
                                </span>
                            )}
                            {diagramId && isLoggedIn && (
                                <button
                                    onClick={handleShare}
                                    className="text-xs text-blue-600"
                                >
                                    {copied ? '✓' : 'Share'}
                                </button>
                            )}
                            {renderStars()}
                            <LanguageNav />
                            {loading ? (
                                <span className="text-xs text-gray-400">
                                    ...
                                </span>
                            ) : isLoggedIn ? (
                                <button
                                    onClick={logout}
                                    className="text-xs text-gray-500 hover:text-gray-900"
                                >
                                    Logout
                                </button>
                            ) : (
                                <button
                                    onClick={() => navigate('/login')}
                                    className="text-xs text-blue-600 hover:text-blue-800"
                                >
                                    Login
                                </button>
                            )}
                        </div>
                    </div>
                    <Menu />
                </div>

                <div className="flex flex-1 justify-center pb-2 pt-1">
                    <DiagramName />
                </div>
            </nav>

            {/* Read-only banner */}
            {!permLoading && !canEdit && (
                <div className="border-b border-yellow-200 bg-yellow-50 px-3 py-1.5 text-center text-[11px] text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-300">
                    Read-only.{' '}
                    <button
                        onClick={() => navigate('/login')}
                        className="font-medium underline"
                    >
                        Login
                    </button>{' '}
                    as owner to edit.
                </div>
            )}
        </>
    );
};
