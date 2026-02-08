import {useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {Link} from 'react-router-dom';
import {ArrowLeft, Loader2, Shield, ShieldOff} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {Badge} from '@/components/ui/badge';
import {getAdminUsers, updateUserRole} from '@/services/api';
import {truncateAddress} from '@/lib/utils';
import {useAuth} from '@/hooks/useAuth';

export function AdminUsers() {
    const {t} = useTranslation('admin');
    const {t: tc} = useTranslation();
    const {isAuthenticated, user: currentUser} = useAuth();
    const queryClient = useQueryClient();
    const [page] = useState(1);

    const {data, isLoading, error} = useQuery({
        queryKey: ['adminUsers', page],
        queryFn: () => getAdminUsers(page),
        enabled: isAuthenticated && currentUser?.role === 'admin',
    });

    const roleMutation = useMutation({
        mutationFn: ({userId, role}: { userId: number; role: 'user' | 'admin' }) =>
            updateUserRole(userId, role),
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['adminUsers']});
        },
    });

    if (!isAuthenticated || currentUser?.role !== 'admin') {
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
                <h1 className="text-3xl font-bold tracking-tight">{t('users.title')}</h1>
                <p className="text-muted-foreground">
                    {data ? t('users.totalUsers', {count: data.total}) : t('loading')}
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
                        <CardTitle className="text-lg">{t('users.usersCard')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {data.data.map((u) => (
                                <div key={u.id}
                                     className="flex items-center justify-between py-3 border-b last:border-0">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-sm">
                                                {u.username ?? truncateAddress(u.wallet_address)}
                                            </span>
                                            <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>
                                                {u.role}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground font-mono mt-0.5">
                                            {u.wallet_address}
                                        </p>
                                    </div>
                                    {u.id !== currentUser.id && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            disabled={roleMutation.isPending}
                                            onClick={() => roleMutation.mutate({
                                                userId: u.id,
                                                role: u.role === 'admin' ? 'user' : 'admin',
                                            })}
                                        >
                                            {u.role === 'admin' ? (
                                                <><ShieldOff className="h-4 w-4 mr-1"/> {t('users.revokeAdmin')}</>
                                            ) : (
                                                <><Shield className="h-4 w-4 mr-1"/> {t('users.makeAdmin')}</>
                                            )}
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
