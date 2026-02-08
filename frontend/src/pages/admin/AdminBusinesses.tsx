import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Link} from 'react-router-dom';
import {ArrowLeft, Loader2} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {Badge} from '@/components/ui/badge';
import {getAdminBusinesses} from '@/services/api';
import {truncateAddress} from '@/lib/utils';
import {useAuth} from '@/hooks/useAuth';

export function AdminBusinesses() {
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
                <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
                <p className="text-muted-foreground">This page requires admin privileges.</p>
            </div>
        );
    }

    return (
        <div className="container py-8 space-y-6">
            <Button asChild variant="ghost" size="sm">
                <Link to="/admin">
                    <ArrowLeft className="h-4 w-4 mr-1"/> Admin
                </Link>
            </Button>

            <div>
                <h1 className="text-3xl font-bold tracking-tight">All Businesses</h1>
                <p className="text-muted-foreground">
                    {data ? `${data.total} total businesses` : 'Loading...'}
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
                        <CardTitle className="text-lg">Businesses</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {data.data.map((biz) => (
                                <Link
                                    key={biz.id}
                                    to={`/businesses/${biz.id}`}
                                    className="flex items-center justify-between py-3 border-b last:border-0 hover:bg-muted/50 -mx-2 px-2 rounded"
                                >
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-sm">{biz.name}</span>
                                            {biz.category && <Badge variant="secondary">{biz.category}</Badge>}
                                            <Badge variant={biz.active ? 'success' : 'destructive'}>
                                                {biz.active ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            Owner: {biz.owner_name ?? truncateAddress(biz.owner_wallet)}
                                        </p>
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                        {new Date(biz.created_at).toLocaleDateString()}
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
