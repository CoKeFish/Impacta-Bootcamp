import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Link} from 'react-router-dom';
import {Package, Search, Store} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {motion} from 'framer-motion';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {Badge} from '@/components/ui/badge';
import {GridSkeleton} from '@/components/ui/skeleton';
import {EmptyState} from '@/components/ui/empty-state';
import {PageHeader} from '@/components/ui/page-header';
import {getServices} from '@/services/api';
import {formatXLM} from '@/lib/utils';
import {fadeInUp, staggerContainer} from '@/lib/motion';

export function ServiceCatalog() {
    const {t} = useTranslation('services');
    const {t: tc} = useTranslation();
    const [search, setSearch] = useState('');

    const {data: services, isLoading, error} = useQuery({
        queryKey: ['services', search],
        queryFn: () => getServices(search || undefined),
    });

    return (
        <div className="flex flex-col">
            <PageHeader
                title={t('catalog.title')}
                subtitle={t('catalog.subtitle')}
            >
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                    <input
                        type="text"
                        placeholder={t('catalog.searchPlaceholder')}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                </div>
            </PageHeader>

            <div className="container py-8 space-y-6">
                {isLoading && <GridSkeleton count={6}/>}

                {error && (
                    <div
                        className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-sm text-destructive">
                        {tc('errors.failedToLoad', {
                            resource: t('catalog.title').toLowerCase(),
                            message: error.message
                        })}
                    </div>
                )}

                {services && services.length === 0 && (
                    <EmptyState
                        icon={search ? Search : Package}
                        title={t('catalog.noResults')}
                        description={search
                            ? t('catalog.noResultsSearchDescription', {defaultValue: 'Try a different search term.'})
                            : t('catalog.noResultsDescription', {defaultValue: 'No services have been listed yet.'})
                        }
                    />
                )}

                {services && services.length > 0 && (
                    <motion.div
                        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                        variants={staggerContainer}
                        initial="hidden"
                        animate="visible"
                    >
                        {services.map((service) => (
                            <motion.div key={service.id} variants={fadeInUp}>
                                <Card
                                    className="h-full transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 overflow-hidden">
                                    {service.image_url && (
                                        <div className="h-36 w-full overflow-hidden">
                                            <img
                                                src={service.image_url}
                                                alt={service.name}
                                                className="h-full w-full object-cover"
                                            />
                                        </div>
                                    )}
                                    <CardHeader className="pb-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <CardTitle className="text-lg line-clamp-1">{service.name}</CardTitle>
                                            <Badge variant="outline"
                                                   className="font-mono tabular-nums whitespace-nowrap">
                                                {formatXLM(service.price)} XLM
                                            </Badge>
                                        </div>
                                        {service.description && (
                                            <p className="text-sm text-muted-foreground line-clamp-2">{service.description}</p>
                                        )}
                                    </CardHeader>
                                    <CardContent>
                                        <Link
                                            to={`/businesses/${service.business_id}`}
                                            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            <span
                                                className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 ring-2 ring-primary/90">
                                                <Store className="h-3.5 w-3.5 text-primary"
                                                       style={{filter: 'drop-shadow(0 0 0.4px hsl(0 0% 0% / 0.25))'}}/>
                                            </span>
                                            {service.business_name}
                                        </Link>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </div>
        </div>
    );
}
