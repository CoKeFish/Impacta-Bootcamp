import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Link} from 'react-router-dom';
import {ArrowLeft, Loader2} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {Button} from '@/components/ui/button';


import {Badge} from '@/components/ui/badge';
import {getAdminBusinesses} from '@/services/api';
import {formatDateFull, truncateAddress} from '@/lib/utils';
import {useAuth} from '@/hooks/useAuth';

export function AdminBusinesses() {
    const {t} = useTranslation('admin');
    const {t: tc} = useTranslation();
    const {isAuthenticated, user} = useAuth();
    const [page] = useState(1);

    const {data, isLoading, error} = useQuery({
        queryKey: ['adminBusinesses', page],
        queryFn: () => getAdminBusinesses(page),
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
                <h1 className="text-3xl font-bold tracking-tight">{t('businesses.title')}</h1>
                <p className="text-muted-foreground">
                    {data ? t('businesses.totalBusinesses', {count: data.total}) : t('loading')}
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
                <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="border-b bg-muted/50">
                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t('businesses.businessesCard')}</th>
                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t('businesses.categoryHeader', {defaultValue: 'Category'})}</th>
                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t('businesses.ownerHeader', {defaultValue: 'Owner'})}</th>
                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t('businesses.statusHeader', {defaultValue: 'Status'})}</th>
                            <th className="text-right px-4 py-3 font-medium text-muted-foreground">{t('businesses.dateHeader', {defaultValue: 'Created'})}</th>
                        </tr>
                        </thead>
                        <tbody>
                        {data.data.map((biz, i) => (
                            <tr
                                    key={biz.id}
                                    className={`border-b last:border-0 hover:bg-muted/50 cursor-pointer ${i % 2 === 1 ? 'bg-muted/20' : ''}`}
                                    onClick={() => window.location.href = `/businesses/${biz.id}`}
                                >
                                <td className="px-4 py-3 font-medium">
                                    <Link to={`/businesses/${biz.id}`} className="hover:underline">
                                        {biz.name}
                                    </Link>
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">
                                    {biz.category ?? '—'}
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">
                                    {biz.owner_name ?? truncateAddress(biz.owner_wallet)}
                                </td>
                                <td className="px-4 py-3">
                                    <Badge variant={biz.active ? 'success' : 'destructive'}>
                                        {biz.active ? tc('status.active') : tc('status.inactive')}
                                    </Badge>
                                </td>
                                <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                                        {formatDateFull(biz.created_at)}
                                </td>
                            </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
