import {useQuery} from '@tanstack/react-query';
import {Link} from 'react-router-dom';
import {Loader2, Plus, Store} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {Badge} from '@/components/ui/badge';
import {getMyBusinesses} from '@/services/api';
import {useAuth} from '@/hooks/useAuth';

export function MyBusinesses() {
    const {t} = useTranslation('businesses');
    const {t: tc} = useTranslation();
    const {isAuthenticated} = useAuth();

    const {data: businesses, isLoading, error} = useQuery({
        queryKey: ['myBusinesses'],
        queryFn: getMyBusinesses,
        enabled: isAuthenticated,
    });

    if (!isAuthenticated) {
        return (
            <div className="container py-20 text-center">
                <h2 className="text-2xl font-bold mb-2">{tc('auth.connectWallet')}</h2>
                <p className="text-muted-foreground">{tc('auth.loginRequired', {action: t('myBusinesses.title').toLowerCase()})}</p>
            </div>
        );
    }

    return (
        <div className="container py-8 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{t('myBusinesses.title')}</h1>
                    <p className="text-muted-foreground">{t('myBusinesses.subtitle')}</p>
                </div>
                <Button asChild>
                    <Link to="/businesses/new">
                        <Plus className="h-4 w-4 mr-1"/> {t('myBusinesses.register')}
                    </Link>
                </Button>
            </div>

            {isLoading && (
                <div className="flex justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/>
                </div>
            )}

            {error && (
                <div
                    className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-sm text-destructive">
                    {tc('errors.failedToLoad', {
                        resource: t('myBusinesses.title').toLowerCase(),
                        message: (error as Error).message
                    })}
                </div>
            )}

            {!isLoading && businesses && businesses.length === 0 && (
                <div className="text-center py-20 space-y-4">
                    <Store className="h-12 w-12 mx-auto text-muted-foreground"/>
                    <div>
                        <p className="text-muted-foreground">{t('myBusinesses.noBusiness')}</p>
                        <Button asChild className="mt-4">
                            <Link to="/businesses/new">{t('myBusinesses.registerFirst')}</Link>
                        </Button>
                    </div>
                </div>
            )}

            {businesses && businesses.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {businesses.map((biz) => (
                        <Link key={biz.id} to={`/businesses/${biz.id}`} className="block">
                            <Card className="h-full transition-shadow hover:shadow-md">
                                <CardHeader className="pb-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <CardTitle className="text-lg line-clamp-1">{biz.name}</CardTitle>
                                        <Badge variant={biz.active ? 'success' : 'secondary'}>
                                            {biz.active ? tc('status.active') : tc('status.inactive')}
                                        </Badge>
                                    </div>
                                    {biz.category && (
                                        <p className="text-xs text-muted-foreground">{biz.category}</p>
                                    )}
                                </CardHeader>
                                <CardContent>
                                    {biz.description && (
                                        <p className="text-sm text-muted-foreground line-clamp-2">{biz.description}</p>
                                    )}
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
