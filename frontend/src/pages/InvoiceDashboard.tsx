import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Link} from 'react-router-dom';
import {FileText, Plus, Search} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {motion} from 'framer-motion';
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardFooter, CardHeader, CardTitle} from '@/components/ui/card';
import {Badge} from '@/components/ui/badge';
import {GridSkeleton} from '@/components/ui/skeleton';
import {EmptyState} from '@/components/ui/empty-state';
import {PageHeader} from '@/components/ui/page-header';
import {getMyInvoices} from '@/services/api';
import {ProgressRing} from '@/components/ui/progress-ring';
import {useAuth} from '@/hooks/useAuth';
import {formatDateShort, formatXLM} from '@/lib/utils';
import {fadeInUp, staggerContainer} from '@/lib/motion';
import type {Invoice} from '@/types';

const statusVariant: Record<string, 'default' | 'secondary' | 'success' | 'destructive' | 'warning'> = {
    draft: 'secondary',
    funding: 'default',
    completed: 'success',
    released: 'success',
    cancelled: 'destructive',
};

const statusBorder: Record<string, string> = {
    draft: 'border-l-muted-foreground/40',
    funding: 'border-l-primary',
    completed: 'border-l-emerald-500',
    released: 'border-l-emerald-500',
    cancelled: 'border-l-destructive',
};

const statusFilters = ['all', 'draft', 'funding', 'completed', 'released', 'cancelled'] as const;

function InvoiceCard({invoice}: { invoice: Invoice }) {
    const {t} = useTranslation('invoices');
    const {t: tc} = useTranslation();
    const collected = parseFloat(invoice.total_collected);
    const target = parseFloat(invoice.total_amount);

    return (
        <Link to={`/invoices/${invoice.id}`} className="block group">
            <Card
                className={`h-full border-l-4 ${statusBorder[invoice.status] ?? ''} transition-all duration-200 hover:shadow-md hover:-translate-y-0.5`}
            >
                <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                            {invoice.icon && <span className="text-lg">{invoice.icon}</span>}
                            <CardTitle className="text-lg line-clamp-1">{invoice.name}</CardTitle>
                        </div>
                        <Badge variant={statusVariant[invoice.status] ?? 'secondary'}>
                            {tc(`status.${invoice.status}`)}
                        </Badge>
                    </div>
                    {invoice.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{invoice.description}</p>
                    )}
                </CardHeader>
                <CardContent className="pb-3">
                    <div className="flex items-center gap-4">
                        <ProgressRing collected={collected} target={target} size="sm"/>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium tabular-nums">
                                {formatXLM(collected)} / {formatXLM(target)} XLM
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {t('dashboard.participants', {count: invoice.participant_count})}
                            </p>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="text-xs text-muted-foreground justify-end">
                    <span>{formatDateShort(invoice.deadline)}</span>
                </CardFooter>
            </Card>
        </Link>
    );
}

export function InvoiceDashboard() {
    const {isAuthenticated} = useAuth();
    const [filter, setFilter] = useState<string>('all');
    const {t} = useTranslation('invoices');
    const {t: tc} = useTranslation();

    const {data, isLoading, error} = useQuery({
        queryKey: ['myInvoices'],
        queryFn: () => getMyInvoices(1, 100),
        enabled: isAuthenticated,
    });

    const invoices = data?.data ?? [];
    const filtered = filter === 'all'
        ? invoices
        : invoices.filter((inv) => inv.status === filter);

    if (!isAuthenticated) {
        return (
            <div className="container py-20 text-center">
                <h2 className="text-2xl font-bold mb-2">{tc('auth.connectWallet')}</h2>
                <p className="text-muted-foreground">{tc('auth.loginRequired', {action: t('dashboard.title').toLowerCase()})}</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col">
            <PageHeader
                title={t('dashboard.title')}
                subtitle={t('dashboard.subtitle')}
                action={
                    <Button asChild>
                        <Link to="/invoices/new">
                            <Plus className="h-4 w-4 mr-1"/> {t('dashboard.newInvoice')}
                        </Link>
                    </Button>
                }
            >
                {/* Status filters */}
                <div className="flex gap-2 flex-wrap">
                    {statusFilters.map((s) => (
                        <button
                            key={s}
                            onClick={() => setFilter(s)}
                            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all duration-200 ${
                                filter === s
                                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                    : 'bg-background text-muted-foreground border-border hover:bg-muted hover:border-muted-foreground/20'
                            }`}
                        >
                            {s === 'all' ? tc('filters.all') : tc(`status.${s}`)}
                            {s !== 'all' && (
                                <span className="ml-1 opacity-70">
                                    ({invoices.filter((inv) => inv.status === s).length})
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </PageHeader>

            <div className="container py-8 space-y-6">
            {isLoading && <GridSkeleton count={6}/>}

            {error && (
                <div
                    className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-sm text-destructive">
                    {tc('errors.failedToLoad', {resource: t('dashboard.title').toLowerCase(), message: error.message})}
                </div>
            )}

            {!isLoading && filtered.length === 0 && (
                <EmptyState
                    icon={filter === 'all' ? FileText : Search}
                    title={filter === 'all' ? t('dashboard.noInvoices') : t('dashboard.noInvoicesFiltered', {filter: tc(`status.${filter}`)})}
                    description={filter === 'all' ? t('dashboard.noInvoicesDescription', {defaultValue: 'Create your first invoice to start collecting group payments.'}) : t('dashboard.noInvoicesFilteredDescription', {defaultValue: 'Try selecting a different status filter.'})}
                    actionLabel={filter === 'all' ? t('dashboard.newInvoice') : undefined}
                    actionHref={filter === 'all' ? '/invoices/new' : undefined}
                />
            )}

            {filtered.length > 0 && (
                <motion.div
                    className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                    variants={staggerContainer}
                    initial="hidden"
                    animate="visible"
                >
                    {filtered.map((invoice) => (
                        <motion.div key={invoice.id} variants={fadeInUp}>
                            <InvoiceCard invoice={invoice}/>
                        </motion.div>
                    ))}
                </motion.div>
            )}
            </div>
        </div>
    );
}
