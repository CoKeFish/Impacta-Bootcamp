import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Link} from 'react-router-dom';
import {ArrowLeft, Loader2} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {Badge} from '@/components/ui/badge';
import {getAdminInvoices} from '@/services/api';
import {formatDateFull, formatXLM, truncateAddress} from '@/lib/utils';
import {useAuth} from '@/hooks/useAuth';

const statusVariant: Record<string, 'default' | 'secondary' | 'success' | 'destructive' | 'warning'> = {
    draft: 'secondary',
    funding: 'default',
    completed: 'success',
    released: 'success',
    cancelled: 'destructive',
};

export function AdminInvoices() {
    const {t} = useTranslation('admin');
    const {t: tc} = useTranslation();
    const {isAuthenticated, user} = useAuth();
    const [page] = useState(1);

    const {data, isLoading, error} = useQuery({
        queryKey: ['adminInvoices', page],
        queryFn: () => getAdminInvoices(page),
        enabled: isAuthenticated && user?.role === 'admin',
    });

    if (!isAuthenticated || user?.role !== 'admin') {
        return (
            <div className="container py-20 text-center">
                <h2 className="text-2xl font-bold mb-2">{tc('auth.accessDenied')}</h2>
                <p className="text-muted-foreground">{tc('auth.adminRequired')}</p>
            </div>
        );
    }

    return (
        <div className="container py-8 space-y-6">
            <Button asChild variant="ghost" size="sm">
                <Link to="/admin">
                    <ArrowLeft className="h-4 w-4 mr-1"/> {t('backToAdmin')}
                </Link>
            </Button>

            <div>
                <h1 className="text-3xl font-bold tracking-tight">{t('invoices.title')}</h1>
                <p className="text-muted-foreground">
                    {data ? t('invoices.totalInvoices', {count: data.total}) : t('loading')}
                </p>
            </div>

            {isLoading && (
                <div className="flex justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/>
                </div>
            )}

            {error && (
                <div
                    className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-sm text-destructive">
                    {(error as Error).message}
                </div>
            )}

            {data && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">{t('invoices.invoicesCard')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {data.data.map((inv) => (
                                <Link
                                    key={inv.id}
                                    to={`/invoices/${inv.id}`}
                                    className="flex items-center justify-between py-3 border-b last:border-0 hover:bg-muted/50 -mx-2 px-2 rounded"
                                >
                                    <div>
                                        <div className="flex items-center gap-2">
                                            {inv.icon && <span>{inv.icon}</span>}
                                            <span className="font-medium text-sm">{inv.name}</span>
                                            <Badge variant={statusVariant[inv.status] ?? 'secondary'}>
                                                {tc(`status.${inv.status}`)}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {t('invoices.organizer', {name: inv.organizer_name ?? truncateAddress(inv.organizer_wallet)})}
                                            {' '}&middot;{' '}
                                            {formatXLM(inv.total_collected)} / {formatXLM(inv.total_amount)} XLM
                                        </p>
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                        {formatDateFull(inv.created_at)}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
