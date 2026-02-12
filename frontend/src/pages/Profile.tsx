import {useQuery} from '@tanstack/react-query';
import {Calendar, User} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {motion} from 'framer-motion';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {useAuth} from '@/hooks/useAuth';
import {getMyInvoices} from '@/services/api';
import {formatDateFull, truncateAddress} from '@/lib/utils';
import {Link} from 'react-router-dom';
import {Badge} from '@/components/ui/badge';
import {Skeleton} from '@/components/ui/skeleton';
import {fadeInUp, staggerContainer} from '@/lib/motion';

const statusVariant: Record<string, 'default' | 'secondary' | 'success' | 'destructive' | 'warning'> = {
    draft: 'secondary',
    funding: 'default',
    completed: 'success',
    released: 'success',
    cancelled: 'destructive',
};

export function Profile() {
    const {t} = useTranslation('profile');
    const {t: tc} = useTranslation();
    const {isAuthenticated, user, address} = useAuth();

    const {data: invoiceData, isLoading} = useQuery({
        queryKey: ['myInvoices'],
        queryFn: () => getMyInvoices(1, 100),
        enabled: isAuthenticated,
    });

    if (!isAuthenticated || !user) {
        return (
            <div className="container py-20 text-center">
                <h2 className="text-2xl font-bold mb-2">{tc('auth.connectWallet')}</h2>
                <p className="text-muted-foreground">{tc('auth.loginRequired', {action: t('title').toLowerCase()})}</p>
            </div>
        );
    }

    const invoices = invoiceData?.data ?? [];
    const organized = invoices.filter((inv) => inv.organizer_wallet === address);
    const participating = invoices.filter((inv) => inv.organizer_wallet !== address);

    return (
        <motion.div
            className="container py-8 max-w-3xl space-y-6"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
        >
            <motion.div variants={fadeInUp}>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <User className="h-5 w-5"/> {t('title')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">{t('wallet')}</span>
                            <span className="text-sm font-mono">{address ? truncateAddress(address, 8) : '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">{t('username')}</span>
                            <span className="text-sm">{user.username ?? t('notSet')}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">{t('role')}</span>
                            <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>{user.role}</Badge>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">{t('joined')}</span>
                            <span className="text-sm flex items-center gap-1">
                                <Calendar className="h-3 w-3"/>
                                {formatDateFull(user.created_at)}
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>

            {isLoading && (
                <div className="space-y-3">
                    <Skeleton className="h-6 w-40"/>
                    <Skeleton className="h-12 w-full"/>
                    <Skeleton className="h-12 w-full"/>
                    <Skeleton className="h-12 w-full"/>
                </div>
            )}

            {organized.length > 0 && (
                <motion.div variants={fadeInUp}>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">{t('organized')}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {organized.map((inv) => (
                                <Link
                                    key={inv.id}
                                    to={`/invoices/${inv.id}`}
                                    className="flex items-center justify-between py-2 border-b last:border-0 hover:bg-muted/50 -mx-2 px-2 rounded transition-colors"
                                >
                                    <span className="font-medium text-sm">{inv.name}</span>
                                    <Badge
                                        variant={statusVariant[inv.status] ?? 'secondary'}>{tc(`status.${inv.status}`)}</Badge>
                                </Link>
                            ))}
                        </CardContent>
                    </Card>
                </motion.div>
            )}

            {participating.length > 0 && (
                <motion.div variants={fadeInUp}>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">{t('participating')}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {participating.map((inv) => (
                                <Link
                                    key={inv.id}
                                    to={`/invoices/${inv.id}`}
                                    className="flex items-center justify-between py-2 border-b last:border-0 hover:bg-muted/50 -mx-2 px-2 rounded transition-colors"
                                >
                                    <span className="font-medium text-sm">{inv.name}</span>
                                    <Badge
                                        variant={statusVariant[inv.status] ?? 'secondary'}>{tc(`status.${inv.status}`)}</Badge>
                                </Link>
                            ))}
                        </CardContent>
                    </Card>
                </motion.div>
            )}
        </motion.div>
    );
}
