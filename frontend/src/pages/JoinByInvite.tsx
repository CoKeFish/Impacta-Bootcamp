import {useState} from 'react';
import {Link, useNavigate, useParams} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {ArrowLeft, Calendar, Loader2, LogIn, Receipt, Target, Users,} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {Badge} from '@/components/ui/badge';
import {getInvoiceByCode, joinInvoice} from '@/services/api';
import {formatXLM, truncateAddress} from '@/lib/utils';
import {ProgressBar} from '@/components/invoice/ProgressBar';
import {InvoiceItemsList} from '@/components/invoice/InvoiceItemsList';
import {useAuth} from '@/hooks/useAuth';

const statusVariant: Record<string, 'default' | 'secondary' | 'success' | 'destructive' | 'warning'> = {
    draft: 'secondary',
    funding: 'default',
    completed: 'success',
    released: 'success',
    cancelled: 'destructive',
};

export function JoinByInvite() {
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
            setError(err instanceof Error ? err.message : 'Failed to join');
        } finally {
            setJoining(false);
        }
    }

    if (!isAuthenticated) {
        return (
            <div className="container py-20 text-center">
                <h2 className="text-2xl font-bold mb-2">Connect your wallet</h2>
                <p className="text-muted-foreground">You need to be logged in to join an invoice.</p>
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

    if (fetchError || !invoice) {
        return (
            <div className="container py-20 text-center">
                <p className="text-destructive">{fetchError?.message ?? 'Invoice not found'}</p>
                <Button asChild variant="link" className="mt-4">
                    <Link to="/invoices">Back to invoices</Link>
                </Button>
            </div>
        );
    }

    // If already participant or organizer, redirect to invoice detail
    if (isAlreadyParticipant || isOrganizer) {
        return (
            <div className="container py-20 text-center space-y-4">
                <h2 className="text-2xl font-bold">You're already in this invoice</h2>
                <p className="text-muted-foreground">You are {isOrganizer ? 'the organizer' : 'a participant'} of this
                    invoice.</p>
                <Button asChild>
                    <Link to={`/invoices/${invoice.id}`}>View Invoice</Link>
                </Button>
            </div>
        );
    }

    const collected = parseFloat(invoice.total_collected);
    const target = parseFloat(invoice.total_amount);
    const isClosed = ['cancelled', 'released'].includes(invoice.status);

    return (
        <div className="container py-8 space-y-6 max-w-2xl">
            <Button asChild variant="ghost" size="sm">
                <Link to="/">
                    <ArrowLeft className="h-4 w-4 mr-1"/> Home
                </Link>
            </Button>

            <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground uppercase tracking-wide">You've been invited to join</p>
                <div className="flex items-center justify-center gap-2">
                    {invoice.icon && <span className="text-3xl">{invoice.icon}</span>}
                    <h1 className="text-3xl font-bold tracking-tight">{invoice.name}</h1>
                </div>
                <Badge variant={statusVariant[invoice.status] ?? 'secondary'}>
                    {invoice.status}
                </Badge>
            </div>

            {invoice.description && (
                <p className="text-center text-muted-foreground">{invoice.description}</p>
            )}

            <p className="text-center text-sm text-muted-foreground">
                Organized by {invoice.organizer_name ?? truncateAddress(invoice.organizer_wallet)}
            </p>

            {/* Stats */}
            <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Target className="h-4 w-4"/> Budget
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatXLM(target)} XLM</div>
                        <p className="text-xs text-muted-foreground">{formatXLM(collected)} XLM collected</p>
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
                        <p className="text-xs text-muted-foreground">
                            {invoice.penalty_percent}% withdrawal penalty
                        </p>
                    </CardContent>
                </Card>
            </div>

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

            {/* Current participants */}
            {invoice.participants && invoice.participants.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Users className="h-5 w-5"/> Current Participants
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
                                        <Badge variant="secondary">{p.status}</Badge>
                                    )}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Join button */}
            {isClosed ? (
                <div className="text-center p-4 rounded-lg bg-muted text-muted-foreground">
                    This invoice is {invoice.status} and no longer accepting participants.
                </div>
            ) : (
                <Button
                    className="w-full h-12 text-lg"
                    onClick={handleJoin}
                    disabled={joining}
                >
                    {joining ? (
                        <Loader2 className="h-5 w-5 animate-spin mr-2"/>
                    ) : (
                        <LogIn className="h-5 w-5 mr-2"/>
                    )}
                    Join this invoice
                </Button>
            )}

            {error && (
                <div
                    className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive text-center">
                    {error}
                </div>
            )}
        </div>
    );
}
