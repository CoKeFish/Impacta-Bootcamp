import {useState} from 'react';
import {Link, useParams} from 'react-router-dom';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {
    AlertTriangle,
    ArrowLeft,
    Calendar,
    Check,
    Clock,
    Loader2,
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
import {formatXLM, truncateAddress} from '@/lib/utils';
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
    const [error, setError] = useState<string | null>(null);
    const queryClient = useQueryClient();

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
        setError(null);
        try {
            await fn();
            queryClient.invalidateQueries({queryKey: ['invoice', invoice.id]});
            queryClient.invalidateQueries({queryKey: ['invoiceParticipants', invoice.id]});
            queryClient.invalidateQueries({queryKey: ['myInvoices']});
            onActionComplete();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Operation failed');
        } finally {
            setActionLoading(null);
        }
    }

    // ── DRAFT status actions ────────────────────────────────────────────

    const handleLinkContract = () =>
        handleAction('link', async () => {
            if (!userWallet || !invoice.items) return;

            // Validate all recipient wallets before building the transaction
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
                await cancelInvoice(invoice.id);
                return;
            }

            if (contractId == null) throw new Error('Invoice not linked to contract');

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
                    Connect your wallet to interact with this invoice.
                </CardContent>
            </Card>
        );
    }

    const isLoading = (name: string) => actionLoading === name;
    const inputClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* ── DRAFT ────────────────────────────────────────────── */}
                {invoice.status === 'draft' && isOrganizer && (
                    <>
                        <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                            This invoice is in draft. Link it to the blockchain to start accepting contributions.
                        </div>
                        <Button
                            className="w-full"
                            onClick={handleLinkContract}
                            disabled={!!actionLoading}
                        >
                            {isLoading('link') ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-1"/>
                            ) : (
                                <Send className="h-4 w-4 mr-1"/>
                            )}
                            Link to blockchain
                        </Button>
                        <Button
                            variant="destructive"
                            className="w-full"
                            onClick={handleCancel}
                            disabled={!!actionLoading}
                        >
                            {isLoading('cancel') && <Loader2 className="h-4 w-4 animate-spin mr-1"/>}
                            <X className="h-4 w-4 mr-1"/> Cancel invoice
                        </Button>
                    </>
                )}

                {/* ── FUNDING ──────────────────────────────────────────── */}
                {invoice.status === 'funding' && (
                    <>
                        {/* Join */}
                        {!isParticipant && !isOrganizer && (
                            <Button
                                className="w-full"
                                onClick={handleJoin}
                                disabled={!!actionLoading}
                            >
                                {isLoading('join') ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-1"/>
                                ) : (
                                    <LogIn className="h-4 w-4 mr-1"/>
                                )}
                                Join this invoice
                            </Button>
                        )}

                        {/* Contribute */}
                        {isParticipant && isActive && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium">
                                    Contribute
                                    {hasContributed && (
                                        <span className="text-muted-foreground font-normal ml-1">
                                            (current: {formatXLM(myParticipation.contributed_amount)} XLM)
                                        </span>
                                    )}
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        max={remaining}
                                        placeholder={`Max ${formatXLM(remaining)} XLM`}
                                        value={contributeAmount}
                                        onChange={(e) => setContributeAmount(e.target.value)}
                                        className={inputClass}
                                    />
                                    <Button
                                        onClick={handleContribute}
                                        disabled={!!actionLoading || !contributeAmount}
                                    >
                                        {isLoading('contribute') ? (
                                            <Loader2 className="h-4 w-4 animate-spin"/>
                                        ) : (
                                            <Send className="h-4 w-4"/>
                                        )}
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
                                {isLoading('withdraw') ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-1"/>
                                ) : (
                                    <Undo2 className="h-4 w-4 mr-1"/>
                                )}
                                Withdraw
                                {invoice.version > (myParticipation?.contributed_at_version ?? 0)
                                    ? ' (no penalty - invoice modified)'
                                    : invoice.penalty_percent > 0
                                        ? ` (${invoice.penalty_percent}% penalty)`
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
                                {isLoading('release') ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-1"/>
                                ) : (
                                    <Check className="h-4 w-4 mr-1"/>
                                )}
                                Release funds
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
                                {isLoading('cancel') && <Loader2 className="h-4 w-4 animate-spin mr-1"/>}
                                <X className="h-4 w-4 mr-1"/> Cancel & refund all
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
                                {isLoading('deadline') ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-1"/>
                                ) : (
                                    <Clock className="h-4 w-4 mr-1"/>
                                )}
                                Claim deadline (refund all)
                            </Button>
                        )}
                    </>
                )}

                {/* ── COMPLETED (waiting for confirmations) ────────────── */}
                {invoice.status === 'completed' && (
                    <>
                        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 text-sm">
                            <div className="flex items-center gap-2 text-green-800 dark:text-green-200 font-medium">
                                <Check className="h-4 w-4"/> Target reached!
                            </div>
                            {!invoice.auto_release && (
                                <p className="text-green-700 dark:text-green-300 mt-1">
                                    Waiting for participant confirmations
                                    ({invoice.confirmation_count}/{invoice.participant_count}).
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
                                {isLoading('confirm') ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-1"/>
                                ) : (
                                    <Check className="h-4 w-4 mr-1"/>
                                )}
                                Confirm release
                            </Button>
                        )}

                        {myParticipation?.confirmed_release && (
                            <div className="text-sm text-muted-foreground text-center">
                                You've already confirmed the release.
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
                                {isLoading('withdraw') ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-1"/>
                                ) : (
                                    <Undo2 className="h-4 w-4 mr-1"/>
                                )}
                                Withdraw ({invoice.penalty_percent}% penalty)
                            </Button>
                        )}

                        {/* Organizer release */}
                        {isOrganizer && (
                            <Button
                                className="w-full"
                                onClick={handleRelease}
                                disabled={!!actionLoading}
                            >
                                {isLoading('release') ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-1"/>
                                ) : (
                                    <Send className="h-4 w-4 mr-1"/>
                                )}
                                Release funds (organizer override)
                            </Button>
                        )}
                    </>
                )}

                {/* ── RELEASED ─────────────────────────────────────────── */}
                {invoice.status === 'released' && (
                    <div
                        className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 text-sm text-green-800 dark:text-green-200 text-center">
                        <Check className="h-5 w-5 mx-auto mb-1"/>
                        Funds have been released to the recipients.
                    </div>
                )}

                {/* ── CANCELLED ────────────────────────────────────────── */}
                {invoice.status === 'cancelled' && (
                    <div
                        className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 text-sm text-red-800 dark:text-red-200 text-center">
                        <X className="h-5 w-5 mx-auto mb-1"/>
                        This invoice has been cancelled. All funds were refunded.
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
    const {address: userWallet, user, isAuthenticated} = useAuth();

    const {data: invoice, isLoading, error, refetch} = useQuery({
        queryKey: ['invoice', invoiceId],
        queryFn: () => getInvoice(invoiceId),
        enabled: !isNaN(invoiceId) && isAuthenticated,
        refetchInterval: 15_000, // Poll every 15s for live updates
    });

    const {data: participants = []} = useQuery({
        queryKey: ['invoiceParticipants', invoiceId],
        queryFn: () => getInvoiceParticipants(invoiceId),
        enabled: !isNaN(invoiceId) && isAuthenticated,
        refetchInterval: 15_000,
    });

    const [copied, setCopied] = useState(false);

    if (!isAuthenticated) {
        return (
            <div className="container py-20 text-center">
                <h2 className="text-2xl font-bold mb-2">Connect your wallet</h2>
                <p className="text-muted-foreground">You need to be logged in to view invoice details.</p>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="container py-20 flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/>
            </div>
        );
    }

    if (error || !invoice) {
        return (
            <div className="container py-20 text-center">
                <p className="text-destructive">{error?.message ?? 'Invoice not found'}</p>
                <Button asChild variant="link" className="mt-4">
                    <Link to="/invoices">Back to invoices</Link>
                </Button>
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
        <div className="container py-8 space-y-6 max-w-4xl">
            <Button asChild variant="ghost" size="sm">
                <Link to="/invoices">
                    <ArrowLeft className="h-4 w-4 mr-1"/> Back
                </Link>
            </Button>

            {/* Header */}
            <div className="space-y-2">
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
                            {invoice.status}
                        </Badge>
                        {invoice.auto_release && (
                            <Badge variant="outline">Auto-release</Badge>
                        )}
                    </div>
                </div>
                {invoice.description && (
                    <p className="text-muted-foreground">{invoice.description}</p>
                )}
                <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                        Organized by {invoice.organizer_name ?? truncateAddress(invoice.organizer_wallet)}
                        {invoice.contract_invoice_id != null && (
                            <span className="ml-2 text-xs font-mono opacity-60">
                                (pool #{invoice.contract_invoice_id})
                            </span>
                        )}
                    </p>
                    {isOrganizer && invoice.invite_code && (
                        <Button variant="outline" size="sm" onClick={handleCopyInviteLink}>
                            {copied ? (
                                <>
                                    <Check className="h-4 w-4 mr-1"/> Copied!
                                </>
                            ) : (
                                <>
                                    <Share2 className="h-4 w-4 mr-1"/> Copy invite link
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </div>

            {/* Modification banner */}
            {myParticipation &&
                invoice.version > myParticipation.contributed_at_version &&
                myParticipation.status === 'active' && (
                    <ModificationBanner
                        version={invoice.version}
                        contributedAtVersion={myParticipation.contributed_at_version}
                        onConfirm={() => {
                            /* Confirm is handled via continue contributing */
                        }}
                        onOptOut={() => {
                            /* Withdraw handles opt-out (penalty-free) */
                        }}
                    />
                )}

            {/* Stats */}
            <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Target className="h-4 w-4"/> Budget
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatXLM(collected)} XLM</div>
                        <p className="text-xs text-muted-foreground">of {formatXLM(target)} XLM target</p>
                        <ProgressBar collected={collected} target={target} className="mt-2"/>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Users className="h-4 w-4"/> Participants
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{invoice.participant_count}</div>
                        <p className="text-xs text-muted-foreground">min {invoice.min_participants} required</p>
                        {invoice.status === 'completed' && !invoice.auto_release && (
                            <p className="text-xs text-primary mt-1">
                                {invoice.confirmation_count}/{invoice.participant_count} confirmed
                            </p>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Calendar className="h-4 w-4"/> Deadline
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {new Date(invoice.deadline).toLocaleDateString('es', {
                                day: 'numeric',
                                month: 'short',
                            })}
                        </div>
                        <p className={`text-xs mt-0.5 ${deadlinePassed ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                            {deadlinePassed ? 'Deadline passed!' : `${invoice.penalty_percent}% withdrawal penalty`}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Actions */}
            <ActionPanel
                invoice={invoice}
                participants={participants}
                userWallet={userWallet}
                userId={user?.id}
                onActionComplete={() => refetch()}
            />

            {/* Items */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Receipt className="h-5 w-5"/> Items ({invoice.items?.length ?? 0})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {invoice.items ? (
                        <InvoiceItemsList items={invoice.items}/>
                    ) : (
                        <p className="text-sm text-muted-foreground">No items</p>
                    )}
                </CardContent>
            </Card>

            {/* Participants */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Users className="h-5 w-5"/> Participants ({participants.length})
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
                                                <Check className="h-3 w-3 mr-0.5"/> confirmed
                                            </Badge>
                                        )}
                                        {p.wallet_address === userWallet && (
                                            <Badge variant="outline" className="text-xs">you</Badge>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <span className="text-sm font-mono">
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
                        <p className="text-sm text-muted-foreground">No participants yet</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
