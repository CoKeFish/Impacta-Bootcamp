import {useState} from 'react';
import {Loader2, LogOut, Wallet} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {Button} from '@/components/ui/button';
import {useAuth} from '@/hooks/useAuth';
import {truncateAddress} from '@/lib/utils';

export function ConnectButton() {
    const {address, isAuthenticated, connectWallet, disconnectWallet} = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const {t} = useTranslation();

    const handleConnect = async () => {
        setLoading(true);
        setError(null);
        try {
            await connectWallet();
        } catch (err) {
            setError(err instanceof Error ? err.message : t('wallet.connectionFailed'));
        } finally {
            setLoading(false);
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
            <Button onClick={handleConnect} disabled={loading} size="sm">
                {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin"/>
                ) : (
                    <Wallet className="h-4 w-4"/>
                )}
                {loading ? t('wallet.connecting') : t('wallet.connect')}
            </Button>
            {error && (
                <span className="text-xs text-destructive max-w-[200px] text-right">{error}</span>
            )}
        </div>
    );
}
