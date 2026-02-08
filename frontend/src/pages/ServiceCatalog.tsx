import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Link} from 'react-router-dom';
import {Loader2, Search, Store} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {getServices} from '@/services/api';
import {formatXLM} from '@/lib/utils';

export function ServiceCatalog() {
    const {t} = useTranslation('services');
    const {t: tc} = useTranslation();
    const [search, setSearch] = useState('');

    const {data: services, isLoading, error} = useQuery({
        queryKey: ['services', search],
        queryFn: () => getServices(search || undefined),
    });

    return (
        <div className="container py-8 space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">{t('catalog.title')}</h1>
                <p className="text-muted-foreground">{t('catalog.subtitle')}</p>
            </div>

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

            {isLoading && (
                <div className="flex justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/>
                </div>
            )}

            {error && (
                <div
                    className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-sm text-destructive">
                    {tc('errors.failedToLoad', {resource: t('catalog.title').toLowerCase(), message: error.message})}
                </div>
            )}

            {services && services.length === 0 && (
                <div className="text-center py-20 text-muted-foreground">
                    {t('catalog.noResults')}
                </div>
            )}

            {services && services.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {services.map((service) => (
                        <Card key={service.id} className="transition-shadow hover:shadow-md">
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between gap-2">
                                    <CardTitle className="text-lg line-clamp-1">{service.name}</CardTitle>
                                    <span className="text-sm font-mono font-medium whitespace-nowrap">
                                        {formatXLM(service.price)} XLM
                                    </span>
                                </div>
                                {service.description && (
                                    <p className="text-sm text-muted-foreground line-clamp-2">{service.description}</p>
                                )}
                            </CardHeader>
                            <CardContent>
                                <Link
                                    to={`/businesses/${service.business_id}`}
                                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <Store className="h-4 w-4"/>
                                    {service.business_name}
                                </Link>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
