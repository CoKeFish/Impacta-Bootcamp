import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Link} from 'react-router-dom';
import {Loader2, Plus} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardFooter, CardHeader, CardTitle} from '@/components/ui/card';
import {Badge} from '@/components/ui/badge';
import {getMyInvoices} from '@/services/api';
import {ProgressBar} from '@/components/invoice/ProgressBar';
import {useAuth} from '@/hooks/useAuth';
import type {Invoice} from '@/types';

const statusVariant: Record<string, 'default' | 'secondary' | 'success' | 'destructive' | 'warning'> = {
    draft: 'secondary',
    funding: 'default',
    completed: 'success',
    released: 'success',
    cancelled: 'destructive',
};

const statusFilters = ['all', 'draft', 'funding', 'completed', 'released', 'cancelled'] as const;

function InvoiceCard({invoice}: { invoice: Invoice }) {
    const collected = parseFloat(invoice.total_collected);
    const target = parseFloat(invoice.total_amount);

    return (
        <Link to={`/invoices/${invoice.id}`} className="block">
            <Card className="h-full transition-shadow hover:shadow-md">
                <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                            {invoice.icon && <span className="text-lg">{invoice.icon}</span>}
                            <CardTitle className="text-lg line-clamp-1">{invoice.name}</CardTitle>
                        </div>
                        <Badge variant={statusVariant[invoice.status] ?? 'secondary'}>
                            {invoice.status}
                        </Badge>
                    </div>
                    {invoice.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{invoice.description}</p>
                    )}
                </CardHeader>
                <CardContent className="pb-3">
                    <ProgressBar collected={collected} target={target}/>
                </CardContent>
                <CardFooter className="text-xs text-muted-foreground justify-between">
                    <span>{invoice.participant_count} participants</span>
                    <span>
                        {new Date(invoice.deadline).toLocaleDateString('es', {day: 'numeric', month: 'short'})}
                    </span>
                </CardFooter>
            </Card>
        </Link>
    );
}

export function InvoiceDashboard() {
    const {isAuthenticated} = useAuth();
    const [filter, setFilter] = useState<string>('all');

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
                <h2 className="text-2xl font-bold mb-2">Connect your wallet</h2>
                <p className="text-muted-foreground">You need to be logged in to view your invoices.</p>
            </div>
        );
    }

    return (
        <div className="container py-8 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">My Invoices</h1>
                    <p className="text-muted-foreground">Invoices you organize or participate in</p>
                </div>
                <Button asChild>
                    <Link to="/invoices/new">
                        <Plus className="h-4 w-4 mr-1"/> New invoice
                    </Link>
                </Button>
            </div>

            {/* Status filters */}
            <div className="flex gap-2 flex-wrap">
                {statusFilters.map((s) => (
                    <button
                        key={s}
                        onClick={() => setFilter(s)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                            filter === s
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background text-muted-foreground border-border hover:bg-muted'
                        }`}
                    >
                        {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                        {s !== 'all' && (
                            <span className="ml-1 opacity-70">
                                ({invoices.filter((inv) => inv.status === s).length})
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {isLoading && (
                <div className="flex justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/>
                </div>
            )}

            {error && (
                <div
                    className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-sm text-destructive">
                    Failed to load invoices: {error.message}
                </div>
            )}

            {!isLoading && filtered.length === 0 && (
                <div className="text-center py-20 text-muted-foreground">
                    {filter === 'all'
                        ? 'No invoices yet. Create your first one!'
                        : `No invoices with status "${filter}".`}
                </div>
            )}

            {filtered.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filtered.map((invoice) => (
                        <InvoiceCard key={invoice.id} invoice={invoice}/>
                    ))}
                </div>
            )}
        </div>
    );
}
