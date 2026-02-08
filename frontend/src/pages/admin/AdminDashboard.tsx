import {useQuery} from '@tanstack/react-query';
import {Link} from 'react-router-dom';
import {BarChart3, FileText, Loader2, Store, Users} from 'lucide-react';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {getAdminStats} from '@/services/api';
import {useAuth} from '@/hooks/useAuth';

export function AdminDashboard() {
    const {isAuthenticated, user} = useAuth();

    const {data: stats, isLoading, error} = useQuery({
        queryKey: ['adminStats'],
        queryFn: getAdminStats,
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
            <div>
                <div className="flex items-center gap-2">
                    <BarChart3 className="h-6 w-6 text-primary"/>
                    <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
                </div>
                <p className="text-muted-foreground">System overview and management</p>
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

            {stats && (
                <div className="grid gap-4 sm:grid-cols-3">
                    <Link to="/admin/users">
                        <Card className="transition-shadow hover:shadow-md cursor-pointer">
                            <CardHeader className="pb-2">
                                <CardTitle
                                    className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                    <Users className="h-4 w-4"/> Users
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold">{stats.users}</div>
                                <p className="text-xs text-muted-foreground mt-1">Registered users</p>
                            </CardContent>
                        </Card>
                    </Link>

                    <Link to="/admin/businesses">
                        <Card className="transition-shadow hover:shadow-md cursor-pointer">
                            <CardHeader className="pb-2">
                                <CardTitle
                                    className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                    <Store className="h-4 w-4"/> Businesses
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold">{stats.businesses}</div>
                                <p className="text-xs text-muted-foreground mt-1">Registered businesses</p>
                            </CardContent>
                        </Card>
                    </Link>

                    <Link to="/admin/invoices">
                        <Card className="transition-shadow hover:shadow-md cursor-pointer">
                            <CardHeader className="pb-2">
                                <CardTitle
                                    className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                    <FileText className="h-4 w-4"/> Invoices
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold">{stats.invoices}</div>
                                <p className="text-xs text-muted-foreground mt-1">Total invoices</p>
                            </CardContent>
                        </Card>
                    </Link>
                </div>
            )}
        </div>
    );
}
