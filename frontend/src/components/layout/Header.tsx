import {useState} from 'react';
import {Link, useLocation} from 'react-router-dom';
import {FileText, Globe, Menu, ShoppingCart, Store, X} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {ConnectButton} from '@/components/wallet/ConnectButton';
import {CartIcon} from '@/components/cart/CartIcon';
import {cn} from '@/lib/utils';
import {useAuth} from '@/hooks/useAuth';
import {type SupportedLanguage, supportedLanguages} from '@/i18n';

function LanguageToggle() {
    const {i18n} = useTranslation();
    const currentLang = (supportedLanguages.includes(i18n.language as SupportedLanguage)
        ? i18n.language
        : 'en') as SupportedLanguage;

    const toggle = () => {
        const idx = supportedLanguages.indexOf(currentLang);
        const next = supportedLanguages[(idx + 1) % supportedLanguages.length];
        i18n.changeLanguage(next);
    };

    return (
        <button
            onClick={toggle}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title={currentLang === 'en' ? 'Cambiar a Español' : 'Switch to English'}
        >
            <Globe className="h-4 w-4"/>
            <span>{currentLang.toUpperCase()}</span>
        </button>
    );
}

export function Header() {
    const location = useLocation();
    const {isAuthenticated} = useAuth();
    const [mobileOpen, setMobileOpen] = useState(false);
    const {t} = useTranslation();

    const publicLinks = [
        {href: '/services', label: t('nav.services'), icon: Store},
    ];

    const authLinks = [
        {href: '/invoices', label: t('nav.invoices'), icon: FileText},
        {href: '/businesses', label: t('nav.myBusinesses'), icon: Store},
    ];

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
                        <img src="/logo.png" alt="CoTravel" className="h-8 w-8"/>
                        <span className="font-serif">CoTravel</span>
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
                    <div className="hidden md:block">
                        <LanguageToggle/>
                    </div>
                    <CartIcon/>
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
                            <>
                                <Link
                                    to="/checkout"
                                    onClick={() => setMobileOpen(false)}
                                    className={cn(
                                        'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-muted',
                                        location.pathname === '/checkout'
                                            ? 'text-foreground bg-muted'
                                            : 'text-muted-foreground',
                                    )}
                                >
                                    <ShoppingCart className="h-4 w-4"/>
                                    {t('nav.cart')}
                                </Link>
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
                                    {t('nav.profile')}
                                </Link>
                            </>
                        )}
                        <div className="border-t mt-2 pt-2">
                            <LanguageToggle/>
                        </div>
                    </nav>
                </div>
            )}
        </header>
    );
}
