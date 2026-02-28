import {useEffect, useRef, useState} from 'react';
import {Loader2, LogOut, Wallet} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {useAccesly} from 'accesly';
import {Button} from '@/components/ui/button';
import {useAuth} from '@/hooks/useAuth';
import {truncateAddress} from '@/lib/utils';

function GoogleIcon({className}: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
            <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"/>
            <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"/>
            <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"/>
            <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"/>
        </svg>
    );
}

export function ConnectButton() {
    const {address, isAuthenticated, connectWallet, connectWithAccesly, disconnectWallet} = useAuth();
    const [loading, setLoading] = useState<'wallet' | 'google' | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [pendingGoogle, setPendingGoogle] = useState(false);
    const {t} = useTranslation();
    const accesly = useAccesly();
    const connectWithAcceslyRef = useRef(connectWithAccesly);
    connectWithAcceslyRef.current = connectWithAccesly;

    // Complete Google login once accesly.wallet becomes available after connect()
    useEffect(() => {
        if (!pendingGoogle || !accesly.wallet) return;
        setPendingGoogle(false);
        connectWithAcceslyRef.current(accesly.wallet)
            .then(() => setLoading(null))
            .catch((err) => {
                setError(err instanceof Error ? err.message : 'Login failed');
                setLoading(null);
            });
    }, [pendingGoogle, accesly.wallet]);

    const handleConnect = async () => {
        setLoading('wallet');
        setError(null);
        try {
            await connectWallet();
        } catch (err) {
            setError(err instanceof Error ? err.message : t('wallet.connectionFailed'));
        } finally {
            setLoading(null);
        }
    };

    const handleGoogleLogin = async () => {
        setLoading('google');
        setError(null);
        try {
            await accesly.connect();
            // Wallet state updates asynchronously in AcceslyProvider context.
            // The useEffect above picks it up once accesly.wallet is populated.
            setPendingGoogle(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : t('wallet.connectionFailed'));
            setLoading(null);
        }
    };

    if (isAuthenticated && address) {
        return (
            <div className="flex items-center gap-2">
                <span
                    className="hidden sm:inline-flex items-center gap-1.5 text-sm font-mono bg-muted/60 px-2.5 py-1 rounded-full">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"/>
                    {truncateAddress(address, 6)}
                </span>
                <Button variant="outline" size="sm" onClick={disconnectWallet}>
                    <LogOut className="h-4 w-4"/>
                    <span className="hidden sm:inline">{t('wallet.disconnect')}</span>
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
                <Button onClick={handleConnect} disabled={!!loading} size="sm">
                    {loading === 'wallet' ? (
                        <Loader2 className="h-4 w-4 animate-spin"/>
                    ) : (
                        <Wallet className="h-4 w-4"/>
                    )}
                    {loading === 'wallet' ? t('wallet.connecting') : t('wallet.connect')}
                </Button>
                <span className="text-xs text-muted-foreground">{t('wallet.or')}</span>
                <Button onClick={handleGoogleLogin} disabled={!!loading} size="sm" variant="outline">
                    {loading === 'google' ? (
                        <Loader2 className="h-4 w-4 animate-spin"/>
                    ) : (
                        <GoogleIcon className="h-4 w-4"/>
                    )}
                    {loading === 'google' ? t('wallet.connecting') : t('wallet.connectGoogle')}
                </Button>
            </div>
            {error && (
                <span className="text-xs text-destructive max-w-[300px] text-right">{error}</span>
            )}
        </div>
    );
}
