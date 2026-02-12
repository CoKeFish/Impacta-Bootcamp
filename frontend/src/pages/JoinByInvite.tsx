import {useState} from 'react';
import {Link, useNavigate, useParams} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {ArrowLeft, Calendar, LogIn, Receipt, Target, Users,} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {motion} from 'framer-motion';
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {Badge} from '@/components/ui/badge';
import {DetailSkeleton} from '@/components/ui/skeleton';
import {getInvoiceByCode, joinInvoice} from '@/services/api';
import {formatDateShort, formatXLM, truncateAddress} from '@/lib/utils';
import {ProgressBar} from '@/components/invoice/ProgressBar';
import {InvoiceItemsList} from '@/components/invoice/InvoiceItemsList';
import {useAuth} from '@/hooks/useAuth';
import {fadeInUp, staggerContainer} from '@/lib/motion';

const statusVariant: Record<string, 'default' | 'secondary' | 'success' | 'destructive' | 'warning'> = {
    draft: 'secondary',
    funding: 'default',
    completed: 'success',
    released: 'success',
    cancelled: 'destructive',
};

export function JoinByInvite() {
    const {t} = useTranslation('invoices');
    const {t: tc} = useTranslation();
    const {code} = useParams<{ code: string }>();
    const navigate = useNavigate();
    const {address: userWallet, isAuthenticated} = useAuth();
    const [joining, setJoining] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const {data: invoice, isLoading, error: fetchError} = useQuery({
        queryKey: ['invoiceByCode', code],
        queryFn: () => getInvoiceByCode(code!),
        enabled: !!code && isAuthenticated,
    });

    // Check if current user is already a participant
    const isAlreadyParticipant = invoice?.participants?.some(
        (p) => p.wallet_address === userWallet && p.status === 'active',
    );
    const isOrganizer = invoice?.organizer_wallet === userWallet;

    async function handleJoin() {
        if (!invoice) return;
        setJoining(true);
        setError(null);
        try {
            await joinInvoice(invoice.id);
            navigate(`/invoices/${invoice.id}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : t('join.failedToJoin'));
        } finally {
            setJoining(false);
        }
    }

    if (!isAuthenticated) {
        return (
            <div className="container py-20 text-center">
                <h2 className="text-2xl font-bold mb-2">{tc('auth.connectWallet')}</h2>
                <p className="text-muted-foreground">{tc('auth.loginRequired', {action: t('join.joinButton').toLowerCase()})}</p>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="container py-8 max-w-2xl">
                <DetailSkeleton/>
            </div>
        );
    }

    if (fetchError || !invoice) {
        return (
            <div className="container py-20 text-center">
                <p className="text-destructive">{fetchError?.message ?? t('join.invoiceNotFound')}</p>
                <Button asChild variant="link" className="mt-4">
                    <Link to="/invoices">{tc('buttons.backToInvoices')}</Link>
                </Button>
            </div>
        );
    }

    // If already participant or organizer, redirect to invoice detail
    if (isAlreadyParticipant || isOrganizer) {
        return (
            <div className="container py-20 text-center space-y-4">
                <h2 className="text-2xl font-bold">{t('join.alreadyIn')}</h2>
                <p className="text-muted-foreground">
                    {t('join.alreadyRole', {role: isOrganizer ? t('join.organizer') : t('join.participant')})}
                </p>
                <Button asChild>
                    <Link to={`/invoices/${invoice.id}`}>{t('join.viewInvoice')}</Link>
                </Button>
            </div>
        );
    }

    const collected = parseFloat(invoice.total_collected);
    const target = parseFloat(invoice.total_amount);
    const isClosed = ['cancelled', 'released'].includes(invoice.status);

    return (
        <motion.div
            className="container py-8 space-y-6 max-w-2xl"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
        >
            <Button asChild variant="ghost" size="sm">
                <Link to="/">
                    <ArrowLeft className="h-4 w-4 mr-1"/> {t('join.home')}
                </Link>
            </Button>

            <motion.div className="text-center space-y-2" variants={fadeInUp}>
                <p className="text-sm text-muted-foreground uppercase tracking-wide">{t('join.invitedToJoin')}</p>
                <div className="flex items-center justify-center gap-2">
                    {invoice.icon && <span className="text-3xl">{invoice.icon}</span>}
                    <h1 className="text-3xl font-bold tracking-tight">{invoice.name}</h1>
                </div>
                <Badge variant={statusVariant[invoice.status] ?? 'secondary'}>
                    {tc(`status.${invoice.status}`)}
                </Badge>
            </motion.div>

            {invoice.description && (
                <p className="text-center text-muted-foreground">{invoice.description}</p>
            )}

            <p className="text-center text-sm text-muted-foreground">
                {t('detail.organizedBy', {name: invoice.organizer_name ?? truncateAddress(invoice.organizer_wallet)})}
            </p>

            {/* Stats */}
            <motion.div className="grid gap-4 sm:grid-cols-3" variants={fadeInUp}>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Target className="h-4 w-4"/> {t('detail.budget')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold tabular-nums">{formatXLM(target)} XLM</div>
                        <p className="text-xs text-muted-foreground">{t('join.collected', {amount: formatXLM(collected)})}</p>
                        <ProgressBar collected={collected} target={target} className="mt-2"/>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Users className="h-4 w-4"/> {t('detail.participantsTitle')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold tabular-nums">{invoice.participant_count}</div>
                        <p className="text-xs text-muted-foreground">{t('detail.minRequired', {count: invoice.min_participants})}</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Calendar className="h-4 w-4"/> {t('detail.deadline')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatDateShort(invoice.deadline)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {t('detail.withdrawalPenalty', {percent: invoice.penalty_percent})}
                        </p>
                    </CardContent>
                </Card>
            </motion.div>

            {/* Items */}
            <motion.div variants={fadeInUp}>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Receipt className="h-5 w-5"/> {t('detail.items', {count: invoice.items?.length ?? 0})}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {invoice.items ? (
                            <InvoiceItemsList items={invoice.items}/>
                        ) : (
                            <p className="text-sm text-muted-foreground">{tc('noItems')}</p>
                        )}
                    </CardContent>
                </Card>
            </motion.div>

            {/* Current participants */}
            {invoice.participants && invoice.participants.length > 0 && (
                <motion.div variants={fadeInUp}>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Users className="h-5 w-5"/> {t('join.currentParticipants')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {invoice.participants.map((p) => (
                                    <div key={p.wallet_address}
                                         className="flex items-center gap-2 py-1 border-b last:border-0">
                                        <span className="text-sm font-medium">
                                            {p.username ?? truncateAddress(p.wallet_address)}
                                        </span>
                                        {p.status !== 'active' && (
                                            <Badge variant="secondary">{tc(`status.${p.status}`)}</Badge>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            )}

            {/* Join button */}
            <motion.div variants={fadeInUp}>
                {isClosed ? (
                    <div className="text-center p-4 rounded-lg bg-muted text-muted-foreground">
                        {t('join.closedMessage', {status: tc(`status.${invoice.status}`)})}
                    </div>
                ) : (
                    <Button
                        className="w-full h-12 text-lg"
                        onClick={handleJoin}
                        disabled={joining}
                    >
                        {joining ? (
                            <span
                                className="h-5 w-5 animate-spin mr-2 border-2 border-current border-t-transparent rounded-full inline-block"/>
                        ) : (
                            <LogIn className="h-5 w-5 mr-2"/>
                        )}
                        {t('join.joinButton')}
                    </Button>
                )}
            </motion.div>

            {error && (
                <div
                    className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive text-center">
                    {error}
                </div>
            )}
        </motion.div>
    );
}
