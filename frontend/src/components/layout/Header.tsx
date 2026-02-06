import {Link, useLocation} from 'react-router-dom';
import {Plane} from 'lucide-react';
import {ConnectButton} from '@/components/wallet/ConnectButton';
import {cn} from '@/lib/utils';

const navLinks = [
    {href: '/trips', label: 'Trips'},
    {href: '/trips/new', label: 'Create', auth: true},
    {href: '/profile', label: 'Profile', auth: true},
];

export function Header() {
    const location = useLocation();

    return (
        <header
            className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-16 items-center justify-between">
                <div className="flex items-center gap-8">
                    <Link to="/" className="flex items-center gap-2 font-bold text-xl">
                        <Plane className="h-6 w-6 text-primary"/>
                        <span>CoTravel</span>
                    </Link>

                    <nav className="hidden md:flex items-center gap-6">
                        {navLinks.map((link) => (
                            <Link
                                key={link.href}
                                to={link.href}
                                className={cn(
                                    'text-sm font-medium transition-colors hover:text-primary',
                                    location.pathname === link.href
                                        ? 'text-foreground'
                                        : 'text-muted-foreground',
                                )}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </nav>
                </div>

                <ConnectButton/>
            </div>
        </header>
    );
}
