import {Link, useParams} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {ArrowLeft, Edit, Loader2, MapPin, Plus, ShoppingCart, Store, Wallet} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {Badge} from '@/components/ui/badge';
import {ScheduleDisplay} from '@/components/ui/schedule-display';
import {ContactInfoDisplay} from '@/components/ui/contact-info-display';
import {getBusiness, getBusinessServices} from '@/services/api';
import {formatXLM, truncateAddress} from '@/lib/utils';
import {useAuth} from '@/hooks/useAuth';
import {useCart} from '@/hooks/useCart';

export function BusinessProfile() {
    const {t} = useTranslation('businesses');
    const {t: tc} = useTranslation();
    const {id} = useParams<{ id: string }>();
    const businessId = Number(id);
    const {user, isAuthenticated} = useAuth();
    const {addItem} = useCart();

    const {data: business, isLoading, error} = useQuery({
        queryKey: ['business', businessId],
        queryFn: () => getBusiness(businessId),
        enabled: !isNaN(businessId),
    });

    const {data: services} = useQuery({
        queryKey: ['businessServices', businessId],
        queryFn: () => getBusinessServices(businessId),
        enabled: !isNaN(businessId),
    });

    const isOwner = user && business && user.id === business.owner_id;

    if (isLoading) {
        return (
            <div className="container py-20 flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/>
            </div>
        );
    }

    if (error || !business) {
        return (
            <div className="container py-20 text-center">
                <p className="text-destructive">{error?.message ?? 'Business not found'}</p>
                <Button asChild variant="link" className="mt-4">
                    <Link to="/services">{tc('buttons.backToCatalog')}</Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="container py-8 space-y-6 max-w-4xl">
            <Button asChild variant="ghost" size="sm">
                <Link to="/services">
                    <ArrowLeft className="h-4 w-4 mr-1"/> {tc('buttons.backToCatalog')}
                </Link>
            </Button>

            {/* Business Header */}
            <div className="flex items-start gap-4">
                {business.logo_url ? (
                    <img src={business.logo_url} alt={business.name}
                         className="h-16 w-16 rounded-lg object-cover border"/>
                ) : (
                    <div className="h-16 w-16 rounded-lg border flex items-center justify-center bg-muted">
                        <Store className="h-8 w-8 text-muted-foreground"/>
                    </div>
                )}
                <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-3xl font-bold tracking-tight">{business.name}</h1>
                        {business.category && (
                            <Badge variant="secondary">{business.category}</Badge>
                        )}
                        {!business.active && (
                            <Badge variant="destructive">{tc('status.inactive')}</Badge>
                        )}
                    </div>
                    {business.description && (
                        <p className="text-muted-foreground mt-1">{business.description}</p>
                    )}
                    <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
                        {(business.location_data || business.location) && (
                            <span className="flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5"/>
                                {business.location_data
                                    ? [business.location_data.address, business.location_data.city, business.location_data.country].filter(Boolean).join(', ')
                                    : business.location}
                            </span>
                        )}
                        {business.wallet_address && (
                            <span className="flex items-center gap-1">
                                <Wallet className="h-3.5 w-3.5"/>
                                {truncateAddress(business.wallet_address)}
                            </span>
                        )}
                        <ScheduleDisplay schedule={business.schedule} compact/>
                        <ContactInfoDisplay contactInfo={business.contact_info} compact/>
                    </div>
                    {/* Full schedule + contact below header */}
                    {(business.schedule || business.contact_info) && (
                        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:gap-8">
                            {business.schedule && !business.schedule.not_applicable && (
                                <div>
                                    <ScheduleDisplay schedule={business.schedule}/>
                                </div>
                            )}
                            {business.contact_info && !business.contact_info.not_applicable && (
                                <div>
                                    <ContactInfoDisplay contactInfo={business.contact_info}/>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                {isOwner && (
                    <Button asChild variant="outline" size="sm">
                        <Link to={`/businesses/${businessId}/edit`}>
                            <Edit className="h-4 w-4 mr-1"/> {t('profile.edit')}
                        </Link>
                    </Button>
                )}
            </div>

            {/* Services */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg">{t('profile.services')}</CardTitle>
                    {isOwner && (
                        <Button asChild size="sm">
                            <Link to={`/businesses/${businessId}/services/new`}>
                                <Plus className="h-4 w-4 mr-1"/> {t('profile.addService')}
                            </Link>
                        </Button>
                    )}
                </CardHeader>
                <CardContent>
                    {services && services.length > 0 ? (
                        <div className="space-y-3">
                            {services.map((service) => (
                                <div key={service.id}
                                     className="flex items-center justify-between py-3 border-b last:border-0">
                                    {service.image_url && (
                                        <img
                                            src={service.image_url}
                                            alt={service.name}
                                            className="h-10 w-10 rounded object-cover border mr-3 flex-shrink-0"
                                        />
                                    )}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="font-medium text-sm">{service.name}</p>
                                            {!service.active && (
                                                <Badge variant="secondary"
                                                       className="text-xs">{tc('status.inactive')}</Badge>
                                            )}
                                        </div>
                                        {service.description && (
                                            <p className="text-xs text-muted-foreground">{service.description}</p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-mono font-medium">
                                            {formatXLM(service.price)} XLM
                                        </span>
                                        {isOwner ? (
                                            <Button asChild variant="ghost" size="sm">
                                                <Link to={`/services/${service.id}/edit`}>
                                                    <Edit className="h-3.5 w-3.5"/>
                                                </Link>
                                            </Button>
                                        ) : isAuthenticated && service.active && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => addItem.mutate({serviceId: service.id})}
                                                disabled={addItem.isPending}
                                            >
                                                <ShoppingCart className="h-3.5 w-3.5"/>
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            {t('profile.noServices')}
                            {isOwner && t('profile.noServicesOwner')}
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
