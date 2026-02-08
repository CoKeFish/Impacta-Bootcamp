import {useState} from 'react';
import {Link, useLocation} from 'react-router-dom';
import {FileText, Menu, Store, X} from 'lucide-react';
import {ConnectButton} from '@/components/wallet/ConnectButton';
import {cn} from '@/lib/utils';
import {useAuth} from '@/hooks/useAuth';

const publicLinks = [
    {href: '/services', label: 'Services', icon: Store},
];

const authLinks = [
    {href: '/invoices', label: 'Invoices', icon: FileText},
    {href: '/businesses', label: 'My Businesses', icon: Store},
];

export function Header() {
    const location = useLocation();
    const {isAuthenticated} = useAuth();
    const [mobileOpen, setMobileOpen] = useState(false);

    const links = [
        ...publicLinks,
        ...(isAuthenticated ? authLinks : []),
    ];

    return (
        <header
            className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-16 items-center justify-between">
                <div className="flex items-center gap-8">
                    <Link to="/" className="flex items-center gap-2 font-bold text-xl">
                        <FileText className="h-6 w-6 text-primary"/>
                        <span>CoTravel</span>
                    </Link>

                    <nav className="hidden md:flex items-center gap-6">
                        {links.map((link) => (
                            <Link
                                key={link.href}
                                to={link.href}
                                className={cn(
                                    'text-sm font-medium transition-colors hover:text-primary',
                                    location.pathname.startsWith(link.href)
                                        ? 'text-foreground'
                                        : 'text-muted-foreground',
                                )}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </nav>
                </div>

                <div className="flex items-center gap-3">
                    <ConnectButton/>
                    <button
                        className="md:hidden p-2 rounded-md hover:bg-muted"
                        onClick={() => setMobileOpen(!mobileOpen)}
                    >
                        {mobileOpen ? <X className="h-5 w-5"/> : <Menu className="h-5 w-5"/>}
                    </button>
                </div>
            </div>

            {/* Mobile nav */}
            {mobileOpen && (
                <div className="md:hidden border-t bg-background">
                    <nav className="container py-4 flex flex-col gap-2">
                        {links.map((link) => (
                            <Link
                                key={link.href}
                                to={link.href}
                                onClick={() => setMobileOpen(false)}
                                className={cn(
                                    'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-muted',
                                    location.pathname.startsWith(link.href)
                                        ? 'text-foreground bg-muted'
                                        : 'text-muted-foreground',
                                )}
                            >
                                <link.icon className="h-4 w-4"/>
                                {link.label}
                            </Link>
                        ))}
                        {isAuthenticated && (
                            <Link
                                to="/profile"
                                onClick={() => setMobileOpen(false)}
                                className={cn(
                                    'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-muted',
                                    location.pathname === '/profile'
                                        ? 'text-foreground bg-muted'
                                        : 'text-muted-foreground',
                                )}
                            >
                                Profile
                            </Link>
                        )}
                    </nav>
                </div>
            )}
        </header>
    );
}
