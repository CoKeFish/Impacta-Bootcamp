import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Link} from 'react-router-dom';
import {MapPin, Package, Search, ShoppingCart, Store} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {motion} from 'framer-motion';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {GridSkeleton} from '@/components/ui/skeleton';
import {EmptyState} from '@/components/ui/empty-state';
import {PageHeader} from '@/components/ui/page-header';
import {ScheduleDisplay} from '@/components/ui/schedule-display';
import {ContactInfoDisplay} from '@/components/ui/contact-info-display';
import {getBusinessCategories, getBusinesses, getBusinessLocations, getServices} from '@/services/api';
import {formatXLM} from '@/lib/utils';
import {fadeInUp, staggerContainer} from '@/lib/motion';
import {useAuth} from '@/hooks/useAuth';
import {useCart} from '@/hooks/useCart';

export function ServiceCatalog() {
    const {t} = useTranslation('services');
    const {t: tc} = useTranslation();
    const {isAuthenticated} = useAuth();
    const {addItem} = useCart();
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('');
    const [minPrice, setMinPrice] = useState('');
    const [maxPrice, setMaxPrice] = useState('');
    const [businessId, setBusinessId] = useState('');
    const [location, setLocation] = useState('');

    const {data: categories} = useQuery({
        queryKey: ['businessCategories'],
        queryFn: getBusinessCategories,
    });

    const {data: businesses} = useQuery({
        queryKey: ['businesses'],
        queryFn: () => getBusinesses(1, 100),
    });

    const {data: locations} = useQuery({
        queryKey: ['businessLocations'],
        queryFn: getBusinessLocations,
    });

    const {data: services, isLoading, error} = useQuery({
        queryKey: ['services', search, category, minPrice, maxPrice, businessId, location],
        queryFn: () => getServices({
            q: search || undefined,
            category: category || undefined,
            min_price: minPrice || undefined,
            max_price: maxPrice || undefined,
            business_id: businessId || undefined,
            location: location || undefined,
        }),
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
                {/* Filter bar */}
                <div className="flex flex-wrap gap-3 items-end">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-muted-foreground">{t('catalog.category')}</label>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                        >
                            <option value="">{tc('filters.all')}</option>
                            {categories?.map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-muted-foreground">{t('catalog.minPrice')}</label>
                        <input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="0"
                            value={minPrice}
                            onChange={(e) => setMinPrice(e.target.value)}
                            className="h-9 w-24 rounded-md border border-input bg-background px-3 text-sm"
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-muted-foreground">{t('catalog.maxPrice')}</label>
                        <input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="--"
                            value={maxPrice}
                            onChange={(e) => setMaxPrice(e.target.value)}
                            className="h-9 w-24 rounded-md border border-input bg-background px-3 text-sm"
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-muted-foreground">{t('catalog.business')}</label>
                        <select
                            value={businessId}
                            onChange={(e) => setBusinessId(e.target.value)}
                            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                        >
                            <option value="">{tc('filters.all')}</option>
                            {businesses?.map((b) => (
                                <option key={b.id} value={String(b.id)}>{b.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-muted-foreground">{t('catalog.location')}</label>
                        <select
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                        >
                            <option value="">{tc('filters.all')}</option>
                            {locations?.map((loc) => (
                                <option key={loc} value={loc}>{loc}</option>
                            ))}
                        </select>
                    </div>
                </div>

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
                                    <CardContent className="space-y-2">
                                        {service.effective_location && (
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <MapPin className="h-3 w-3"/>
                                                {service.effective_location}
                                            </div>
                                        )}
                                        <ScheduleDisplay schedule={service.effective_schedule} compact/>
                                        <ContactInfoDisplay contactInfo={service.effective_contact_info} compact/>
                                        <div className="flex items-center justify-between gap-2">
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
                                            {isAuthenticated && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => addItem.mutate({serviceId: service.id})}
                                                    disabled={addItem.isPending}
                                                >
                                                    <ShoppingCart className="h-4 w-4 mr-1"/>
                                                    {t('catalog.addToCart')}
                                                </Button>
                                            )}
                                        </div>
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
