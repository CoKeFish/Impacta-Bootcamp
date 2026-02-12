import {useEffect, useState} from 'react';
import {Link, useNavigate, useParams} from 'react-router-dom';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {toast} from 'sonner';
import {useTranslation} from 'react-i18next';
import {motion} from 'framer-motion';
import {
    AlertTriangle,
    ArrowLeft,
    Calendar,
    Check,
    Clock,
    LogIn,
    Receipt,
    Send,
    Share2,
    Target,
    Undo2,
    Users,
    X,
} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {Badge} from '@/components/ui/badge';
import {DetailSkeleton} from '@/components/ui/skeleton';
import {TransactionProgress} from '@/components/ui/transaction-progress';
import {
    cancelInvoice,
    claimDeadline,
    confirmRelease,
    contributeToInvoice,
    getInvoice,
    getInvoiceParticipants,
    joinInvoice,
    linkInvoiceContract,
    releaseInvoice,
    withdrawFromInvoice,
} from '@/services/api';
import {formatDateShort, formatXLM, truncateAddress} from '@/lib/utils';
import {
    buildAndSign,
    buildCancelTx,
    buildClaimDeadlineTx,
    buildConfirmReleaseTx,
    buildContributeTx,
    buildCreateInvoiceTx,
    buildReleaseTx,
    buildWithdrawTx,
    xlmToStroops,
} from '@/lib/soroban';
import {ProgressBar} from '@/components/invoice/ProgressBar';
import {InvoiceItemsList} from '@/components/invoice/InvoiceItemsList';
import {ModificationBanner} from '@/components/invoice/ModificationBanner';
import {useAuth} from '@/hooks/useAuth';
import {fadeInUp, staggerContainer} from '@/lib/motion';
import type {Invoice, InvoiceParticipant} from '@/types';

// ─── Status helpers ─────────────────────────────────────────────────────────

const statusVariant: Record<string, 'default' | 'secondary' | 'success' | 'destructive' | 'warning'> = {
    draft: 'secondary',
    funding: 'default',
    completed: 'success',
    released: 'success',
    cancelled: 'destructive',
};

function isDeadlinePassed(deadline: string): boolean {
    return new Date(deadline) < new Date();
}

// ─── Action Panel ───────────────────────────────────────────────────────────

interface ActionPanelProps {
    invoice: Invoice & { items?: Invoice['items'] };
    participants: InvoiceParticipant[];
    userWallet: string | null;
    userId: number | undefined;
    onActionComplete: () => void;
}

function ActionPanel({invoice, participants, userWallet, userId, onActionComplete}: ActionPanelProps) {
    const [contributeAmount, setContributeAmount] = useState('');
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [txStep, setTxStep] = useState<'signing' | 'confirming' | 'done' | null>(null);
    const [error, setError] = useState<string | null>(null);
    const queryClient = useQueryClient();
    const {t} = useTranslation('invoices');

    const isOrganizer = userId === invoice.organizer_id;
    const myParticipation = participants.find((p) => p.user_id === userId);
    const isParticipant = !!myParticipation;
    const hasContributed = isParticipant && parseFloat(myParticipation.contributed_amount) > 0;
    const isActive = myParticipation?.status === 'active';
    const deadlinePassed = isDeadlinePassed(invoice.deadline);
    const collected = parseFloat(invoice.total_collected);
    const target = parseFloat(invoice.total_amount);
    const remaining = Math.max(0, target - collected);

    async function handleAction(actionName: string, fn: () => Promise<void>) {
        setActionLoading(actionName);
        setTxStep('signing');
        setError(null);
        try {
            await fn();
            setTxStep('done');
            queryClient.invalidateQueries({queryKey: ['invoice', invoice.id]});
            queryClient.invalidateQueries({queryKey: ['invoiceParticipants', invoice.id]});
            queryClient.invalidateQueries({queryKey: ['myInvoices']});
            onActionComplete();
        } catch (err) {
            setError(err instanceof Error ? err.message : t('actions.operationFailed'));
        } finally {
            setTimeout(() => {
                setActionLoading(null);
                setTxStep(null);
            }, 1500);
        }
    }

    // ── DRAFT status actions ────────────────────────────────────────────

    const handleLinkContract = () =>
        handleAction('link', async () => {
            if (!userWallet || !invoice.items) return;

            const invalidItems = invoice.items.filter((item) => {
                if (!item.recipient_wallet) return false;
                return !/^G[A-Z2-7]{55}$/.test(item.recipient_wallet);
            });
            if (invalidItems.length > 0) {
                const names = invalidItems.map((i) => i.description).join(', ');
                throw new Error(`Invalid Stellar wallet address in: ${names}`);
            }

            const recipients = invoice.items
                .filter((item) => item.recipient_wallet)
                .map((item) => ({
                    address: item.recipient_wallet!,
                    amount: xlmToStroops(item.amount),
                }));

            setTxStep('confirming');
            const signedXdr = await buildAndSign(
                () =>
                    buildCreateInvoiceTx({
                        organizer: userWallet,
                        targetAmount: xlmToStroops(invoice.total_amount),
                        minParticipants: invoice.min_participants,
                        deadline: Math.floor(new Date(invoice.deadline).getTime() / 1000),
                        penaltyPercent: invoice.penalty_percent,
                        recipients,
                        autoRelease: invoice.auto_release,
                    }),
                userWallet,
            );

            await linkInvoiceContract(invoice.id, signedXdr);
        });

    // ── FUNDING status actions ──────────────────────────────────────────

    const handleJoin = () =>
        handleAction('join', async () => {
            setTxStep('confirming');
            await joinInvoice(invoice.id);
        });

    const handleContribute = () =>
        handleAction('contribute', async () => {
            if (!userWallet) return;
            const amount = parseFloat(contributeAmount);
            if (isNaN(amount) || amount <= 0) throw new Error('Enter a valid amount');
            if (amount > remaining) throw new Error(`Max contribution is ${formatXLM(remaining)} XLM`);

            const contractId = invoice.contract_invoice_id;
            if (contractId == null) throw new Error('Invoice not linked to contract');

            setTxStep('confirming');
            const signedXdr = await buildAndSign(
                () =>
                    buildContributeTx({
                        tripId: contractId,
                        participant: userWallet,
                        amount: xlmToStroops(amount),
                    }),
                userWallet,
            );

            await contributeToInvoice(invoice.id, signedXdr, amount);
            setContributeAmount('');
        });

    const handleWithdraw = () =>
        handleAction('withdraw', async () => {
            if (!userWallet) return;
            const contractId = invoice.contract_invoice_id;
            if (contractId == null) throw new Error('Invoice not linked to contract');

            setTxStep('confirming');
            const signedXdr = await buildAndSign(
                () =>
                    buildWithdrawTx({
                        tripId: contractId,
                        participant: userWallet,
                    }),
                userWallet,
            );

            await withdrawFromInvoice(invoice.id, signedXdr);
        });

    // ── COMPLETED / Confirm actions ─────────────────────────────────────

    const handleConfirmRelease = () =>
        handleAction('confirm', async () => {
            if (!userWallet) return;
            const contractId = invoice.contract_invoice_id;
            if (contractId == null) throw new Error('Invoice not linked to contract');

            setTxStep('confirming');
            const signedXdr = await buildAndSign(
                () =>
                    buildConfirmReleaseTx({
                        tripId: contractId,
                        participant: userWallet,
                    }),
                userWallet,
            );

            await confirmRelease(invoice.id, signedXdr);
        });

    // ── Release / Cancel / Deadline ─────────────────────────────────────

    const handleRelease = () =>
        handleAction('release', async () => {
            if (!userWallet) return;
            const contractId = invoice.contract_invoice_id;
            if (contractId == null) throw new Error('Invoice not linked to contract');

            setTxStep('confirming');
            const signedXdr = await buildAndSign(
                () =>
                    buildReleaseTx({
                        tripId: contractId,
                        organizer: userWallet,
                    }),
                userWallet,
            );

            await releaseInvoice(invoice.id, signedXdr);
        });

    const handleCancel = () =>
        handleAction('cancel', async () => {
            if (!userWallet) return;
            const contractId = invoice.contract_invoice_id;

            if (invoice.status === 'draft') {
                setTxStep('confirming');
                await cancelInvoice(invoice.id);
                return;
            }

            if (contractId == null) throw new Error('Invoice not linked to contract');

            setTxStep('confirming');
            const signedXdr = await buildAndSign(
                () =>
                    buildCancelTx({
                        tripId: contractId,
                        organizer: userWallet,
                    }),
                userWallet,
            );

            await cancelInvoice(invoice.id, signedXdr);
        });

    const handleClaimDeadline = () =>
        handleAction('deadline', async () => {
            if (!userWallet) return;
            const contractId = invoice.contract_invoice_id;
            if (contractId == null) throw new Error('Invoice not linked to contract');

            setTxStep('confirming');
            const signedXdr = await buildAndSign(
                () =>
                    buildClaimDeadlineTx({
                        tripId: contractId,
                        caller: userWallet,
                    }),
                userWallet,
            );

            await claimDeadline(invoice.id, signedXdr);
        });

    // ── Render ──────────────────────────────────────────────────────────

    if (!userWallet) {
        return (
            <Card>
                <CardContent className="py-6 text-center text-muted-foreground">
                    {t('actions.connectToInteract')}
                </CardContent>
            </Card>
        );
    }

    const inputClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

    const txProgressSteps = actionLoading && txStep ? [
        {
            label: t('actions.txSigning', {defaultValue: 'Signing transaction...'}),
            status: (txStep === 'signing' ? 'active' : 'done') as 'active' | 'done'
        },
        {
            label: t('actions.txConfirming', {defaultValue: 'Confirming on Stellar...'}),
            status: (txStep === 'confirming' ? 'active' : txStep === 'done' ? 'done' : 'pending') as 'active' | 'done' | 'pending'
        },
        {
            label: t('actions.txDone', {defaultValue: 'Transaction confirmed'}),
            status: (txStep === 'done' ? 'done' : 'pending') as 'done' | 'pending'
        },
    ] : null;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">{t('detail.actions')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Transaction progress indicator */}
                {txProgressSteps && (
                    <TransactionProgress steps={txProgressSteps}/>
                )}

                {/* ── DRAFT ────────────────────────────────────────────── */}
                {invoice.status === 'draft' && isOrganizer && !actionLoading && (
                    <>
                        <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                            {t('actions.draftInfo')}
                        </div>
                        <Button
                            className="w-full"
                            onClick={handleLinkContract}
                            disabled={!!actionLoading}
                        >
                            <Send className="h-4 w-4 mr-1"/>
                            {t('actions.linkToBlockchain')}
                        </Button>
                        <Button
                            variant="destructive"
                            className="w-full"
                            onClick={handleCancel}
                            disabled={!!actionLoading}
                        >
                            <X className="h-4 w-4 mr-1"/> {t('actions.cancelInvoice')}
                        </Button>
                    </>
                )}

                {/* ── FUNDING ──────────────────────────────────────────── */}
                {invoice.status === 'funding' && !actionLoading && (
                    <>
                        {/* Join */}
                        {!isParticipant && (
                            <Button
                                className="w-full"
                                onClick={handleJoin}
                                disabled={!!actionLoading}
                            >
                                <LogIn className="h-4 w-4 mr-1"/>
                                {t('actions.joinInvoice')}
                            </Button>
                        )}

                        {/* Contribute */}
                        {isParticipant && isActive && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium">
                                    {t('actions.contribute')}
                                    {hasContributed && (
                                        <span className="text-muted-foreground font-normal ml-1">
                                            {t('actions.currentContribution', {amount: formatXLM(myParticipation.contributed_amount)})}
                                        </span>
                                    )}
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        max={remaining}
                                        placeholder={t('actions.maxContribution', {amount: formatXLM(remaining)})}
                                        value={contributeAmount}
                                        onChange={(e) => setContributeAmount(e.target.value)}
                                        className={inputClass}
                                    />
                                    <Button
                                        onClick={handleContribute}
                                        disabled={!!actionLoading || !contributeAmount}
                                    >
                                        <Send className="h-4 w-4"/>
                                    </Button>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="flex-1"
                                        onClick={() => {
                                            const share = Math.min(target / invoice.min_participants, remaining);
                                            setContributeAmount(share.toFixed(2));
                                        }}
                                    >
                                        {t('actions.fairShare', {amount: formatXLM(target / invoice.min_participants)})}
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="flex-1"
                                        onClick={() => setContributeAmount(remaining.toFixed(2))}
                                    >
                                        {t('actions.max', {amount: formatXLM(remaining)})}
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Withdraw */}
                        {isParticipant && isActive && hasContributed && (
                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={handleWithdraw}
                                disabled={!!actionLoading}
                            >
                                <Undo2 className="h-4 w-4 mr-1"/>
                                {t('actions.withdraw')}
                                {invoice.version > (myParticipation?.contributed_at_version ?? 0)
                                    ? t('actions.withdrawNoPenalty')
                                    : invoice.penalty_percent > 0
                                        ? t('actions.withdrawPenalty', {percent: invoice.penalty_percent})
                                        : ''}
                            </Button>
                        )}

                        {/* Organizer: Release if target met */}
                        {isOrganizer && collected >= target && (
                            <Button
                                className="w-full"
                                onClick={handleRelease}
                                disabled={!!actionLoading}
                            >
                                <Check className="h-4 w-4 mr-1"/>
                                {t('actions.releaseFunds')}
                            </Button>
                        )}

                        {/* Organizer: Cancel */}
                        {isOrganizer && (
                            <Button
                                variant="destructive"
                                className="w-full"
                                onClick={handleCancel}
                                disabled={!!actionLoading}
                            >
                                <X className="h-4 w-4 mr-1"/> {t('actions.cancelRefund')}
                            </Button>
                        )}

                        {/* Deadline claim */}
                        {deadlinePassed && (
                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={handleClaimDeadline}
                                disabled={!!actionLoading}
                            >
                                <Clock className="h-4 w-4 mr-1"/>
                                {t('actions.claimDeadline')}
                            </Button>
                        )}
                    </>
                )}

                {/* ── COMPLETED (waiting for confirmations) ────────────── */}
                {invoice.status === 'completed' && !actionLoading && (
                    <>
                        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 text-sm">
                            <div className="flex items-center gap-2 text-green-800 dark:text-green-200 font-medium">
                                <Check className="h-4 w-4"/> {t('actions.targetReached')}
                            </div>
                            {!invoice.auto_release && (
                                <p className="text-green-700 dark:text-green-300 mt-1">
                                    {t('actions.waitingConfirmations', {
                                        count: invoice.confirmation_count,
                                        total: invoice.participant_count
                                    })}
                                </p>
                            )}
                        </div>

                        {/* Participant confirm */}
                        {isParticipant && isActive && !myParticipation.confirmed_release && !invoice.auto_release && (
                            <Button
                                className="w-full"
                                onClick={handleConfirmRelease}
                                disabled={!!actionLoading}
                            >
                                <Check className="h-4 w-4 mr-1"/>
                                {t('actions.confirmRelease')}
                            </Button>
                        )}

                        {myParticipation?.confirmed_release && (
                            <div className="text-sm text-muted-foreground text-center">
                                {t('actions.alreadyConfirmed')}
                            </div>
                        )}

                        {/* Participant withdraw (still allowed) */}
                        {isParticipant && isActive && hasContributed && (
                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={handleWithdraw}
                                disabled={!!actionLoading}
                            >
                                <Undo2 className="h-4 w-4 mr-1"/>
                                {t('actions.withdrawPenaltyShort', {percent: invoice.penalty_percent})}
                            </Button>
                        )}

                        {/* Organizer release */}
                        {isOrganizer && (
                            <Button
                                className="w-full"
                                onClick={handleRelease}
                                disabled={!!actionLoading}
                            >
                                <Send className="h-4 w-4 mr-1"/>
                                {t('actions.releaseOrganizer')}
                            </Button>
                        )}
                    </>
                )}

                {/* ── RELEASED ─────────────────────────────────────────── */}
                {invoice.status === 'released' && (
                    <div
                        className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 text-sm text-green-800 dark:text-green-200 text-center">
                        <Check className="h-5 w-5 mx-auto mb-1"/>
                        {t('actions.fundsReleased')}
                    </div>
                )}

                {/* ── CANCELLED ────────────────────────────────────────── */}
                {invoice.status === 'cancelled' && (
                    <div
                        className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 text-sm text-red-800 dark:text-red-200 text-center">
                        <X className="h-5 w-5 mx-auto mb-1"/>
                        {t('actions.invoiceCancelled')}
                    </div>
                )}

                {/* Error display */}
                {error && (
                    <div
                        className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5"/>
                        {error}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function InvoiceDetail() {
    const {id} = useParams<{ id: string }>();
    const invoiceId = Number(id);
    const navigate = useNavigate();
    const {address: userWallet, user, isAuthenticated} = useAuth();
    const {t} = useTranslation('invoices');
    const {t: tc} = useTranslation();

    const {data: invoice, isLoading, error, refetch} = useQuery({
        queryKey: ['invoice', invoiceId],
        queryFn: () => getInvoice(invoiceId),
        enabled: !isNaN(invoiceId) && isAuthenticated,
        refetchInterval: 15_000,
        retry: false,
    });

    const {data: participants = []} = useQuery({
        queryKey: ['invoiceParticipants', invoiceId],
        queryFn: () => getInvoiceParticipants(invoiceId),
        enabled: !isNaN(invoiceId) && isAuthenticated && !error,
        refetchInterval: 15_000,
    });

    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!error) return;
        const msg = error.message || 'Invoice not found';
        toast.error(msg);
        navigate('/invoices', {replace: true});
    }, [error, navigate]);

    if (!isAuthenticated) {
        return (
            <div className="container py-20 text-center">
                <h2 className="text-2xl font-bold mb-2">{tc('auth.connectWallet')}</h2>
                <p className="text-muted-foreground">{tc('auth.loginRequired', {action: t('dashboard.title').toLowerCase()})}</p>
            </div>
        );
    }

    if (isLoading || !invoice) {
        return (
            <div className="container py-8 max-w-4xl">
                <DetailSkeleton/>
            </div>
        );
    }

    const collected = parseFloat(invoice.total_collected);
    const target = parseFloat(invoice.total_amount);
    const myParticipation = participants.find((p) => p.user_id === user?.id);
    const deadlinePassed = isDeadlinePassed(invoice.deadline);
    const isOrganizer = user?.id === invoice.organizer_id;

    function handleCopyInviteLink() {
        if (!invoice?.invite_code) return;
        const link = `${window.location.origin}/join/${invoice.invite_code}`;
        navigator.clipboard.writeText(link).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }

    return (
        <motion.div
            className="container py-8 space-y-6 max-w-4xl"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
        >
            <Button asChild variant="ghost" size="sm">
                <Link to="/invoices">
                    <ArrowLeft className="h-4 w-4 mr-1"/> {tc('buttons.back')}
                </Link>
            </Button>

            {/* Header */}
            <motion.div className="space-y-2" variants={fadeInUp}>
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2">
                        {invoice.icon && <span className="text-2xl">{invoice.icon}</span>}
                        <h1 className="text-3xl font-bold tracking-tight">{invoice.name}</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        {invoice.version > 0 && (
                            <Badge variant="warning">v{invoice.version}</Badge>
                        )}
                        <Badge variant={statusVariant[invoice.status] ?? 'secondary'}>
                            {tc(`status.${invoice.status}`)}
                        </Badge>
                        {invoice.auto_release && (
                            <Badge variant="outline">{t('detail.autoRelease')}</Badge>
                        )}
                    </div>
                </div>
                {invoice.description && (
                    <p className="text-muted-foreground">{invoice.description}</p>
                )}
                <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                        {t('detail.organizedBy', {name: invoice.organizer_name ?? truncateAddress(invoice.organizer_wallet)})}
                        {invoice.contract_invoice_id != null && (
                            <span className="ml-2 text-xs font-mono opacity-60">
                                ({t('detail.pool', {id: invoice.contract_invoice_id})})
                            </span>
                        )}
                    </p>
                    {isOrganizer && invoice.invite_code && (
                        <Button variant="outline" size="sm" onClick={handleCopyInviteLink}>
                            {copied ? (
                                <>
                                    <Check className="h-4 w-4 mr-1"/> {t('detail.copied')}
                                </>
                            ) : (
                                <>
                                    <Share2 className="h-4 w-4 mr-1"/> {t('detail.copyInviteLink')}
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </motion.div>

            {/* Modification banner */}
            {myParticipation &&
                invoice.version > myParticipation.contributed_at_version &&
                myParticipation.status === 'active' && (
                    <ModificationBanner
                        version={invoice.version}
                        contributedAtVersion={myParticipation.contributed_at_version}
                        onConfirm={() => {
                        }}
                        onOptOut={() => {
                        }}
                    />
                )}

            {/* Stats */}
            <motion.div className="grid gap-4 sm:grid-cols-3" variants={fadeInUp}>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Target className="h-4 w-4"/> {t('detail.budget')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold tabular-nums">{formatXLM(collected)} XLM</div>
                        <p className="text-xs text-muted-foreground">{t('detail.ofTarget', {amount: formatXLM(target)})}</p>
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
                        {invoice.status === 'completed' && !invoice.auto_release && (
                            <p className="text-xs text-primary mt-1">
                                {t('detail.confirmed', {
                                    count: invoice.confirmation_count,
                                    total: invoice.participant_count
                                })}
                            </p>
                        )}
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
                        <p className={`text-xs mt-0.5 ${deadlinePassed ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                            {deadlinePassed ? t('detail.deadlinePassed') : t('detail.withdrawalPenalty', {percent: invoice.penalty_percent})}
                        </p>
                    </CardContent>
                </Card>
            </motion.div>

            {/* Actions */}
            <motion.div variants={fadeInUp}>
                <ActionPanel
                    invoice={invoice}
                    participants={participants}
                    userWallet={userWallet}
                    userId={user?.id}
                    onActionComplete={() => refetch()}
                />
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

            {/* Participants */}
            <motion.div variants={fadeInUp}>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Users className="h-5 w-5"/> {t('detail.participantsList', {count: participants.length})}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {participants.length > 0 ? (
                            <div className="space-y-3">
                                {participants.map((p) => (
                                    <div
                                        key={p.id}
                                        className="flex items-center justify-between py-2 border-b last:border-0"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-sm">
                                                {p.username ?? truncateAddress(p.wallet_address)}
                                            </span>
                                            {p.status !== 'active' && (
                                                <Badge variant="secondary">{p.status}</Badge>
                                            )}
                                            {p.confirmed_release && (
                                                <Badge variant="success" className="text-xs">
                                                    <Check
                                                        className="h-3 w-3 mr-0.5"/> {t('actions.confirmRelease').toLowerCase()}
                                                </Badge>
                                            )}
                                            {p.wallet_address === userWallet && (
                                                <Badge variant="outline" className="text-xs">{t('detail.you')}</Badge>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <span className="text-sm font-mono tabular-nums">
                                                {formatXLM(p.contributed_amount)} XLM
                                            </span>
                                            {p.contributed_at_version < invoice.version && p.status === 'active' && (
                                                <p className="text-xs text-amber-600">v{p.contributed_at_version}</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">{t('detail.noParticipants')}</p>
                        )}
                    </CardContent>
                </Card>
            </motion.div>
        </motion.div>
    );
}
