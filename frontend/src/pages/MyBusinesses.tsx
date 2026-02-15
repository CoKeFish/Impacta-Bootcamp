import {useQuery} from '@tanstack/react-query';
import {Link} from 'react-router-dom';
import {Plus, Store} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {motion} from 'framer-motion';
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {Badge} from '@/components/ui/badge';
import {GridSkeleton} from '@/components/ui/skeleton';
import {EmptyState} from '@/components/ui/empty-state';
import {PageHeader} from '@/components/ui/page-header';
import {getMyBusinesses} from '@/services/api';
import {useAuth} from '@/hooks/useAuth';
import {fadeInUp, staggerContainer} from '@/lib/motion';

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
        <div className="flex flex-col">
            <PageHeader
                title={t('myBusinesses.title')}
                subtitle={t('myBusinesses.subtitle')}
                action={
                    <Button asChild>
                        <Link to="/businesses/new">
                            <Plus className="h-4 w-4 mr-1"/> {t('myBusinesses.register')}
                        </Link>
                    </Button>
                }
            />

            <div className="container py-8 space-y-6">
            {isLoading && <GridSkeleton count={3}/>}

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
                <EmptyState
                    icon={Store}
                    title={t('myBusinesses.noBusiness')}
                    description={t('myBusinesses.noBusinessDescription', {defaultValue: 'Register your first business to start offering services.'})}
                    actionLabel={t('myBusinesses.registerFirst')}
                    actionHref="/businesses/new"
                />
            )}

            {businesses && businesses.length > 0 && (
                <motion.div
                    className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                    variants={staggerContainer}
                    initial="hidden"
                    animate="visible"
                >
                    {businesses.map((biz) => (
                        <motion.div key={biz.id} variants={fadeInUp}>
                            <Link to={`/businesses/${biz.id}`} className="block group">
                                <Card
                                    className="h-full transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
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
                        </motion.div>
                    ))}
                </motion.div>
            )}
            </div>
        </div>
    );
}
