import {Link, useParams} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {ArrowLeft, Edit, Loader2, Mail, Plus, Store, Wallet} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {Badge} from '@/components/ui/badge';
import {getBusiness, getBusinessServices} from '@/services/api';
import {formatXLM, truncateAddress} from '@/lib/utils';
import {useAuth} from '@/hooks/useAuth';

export function BusinessProfile() {
    const {id} = useParams<{ id: string }>();
    const businessId = Number(id);
    const {user} = useAuth();

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
                    <Link to="/services">Back to catalog</Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="container py-8 space-y-6 max-w-4xl">
            <Button asChild variant="ghost" size="sm">
                <Link to="/services">
                    <ArrowLeft className="h-4 w-4 mr-1"/> Back to catalog
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
                            <Badge variant="destructive">Inactive</Badge>
                        )}
                    </div>
                    {business.description && (
                        <p className="text-muted-foreground mt-1">{business.description}</p>
                    )}
                    <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                        {business.wallet_address && (
                            <span className="flex items-center gap-1">
                                <Wallet className="h-3.5 w-3.5"/>
                                {truncateAddress(business.wallet_address)}
                            </span>
                        )}
                        {business.contact_email && (
                            <span className="flex items-center gap-1">
                                <Mail className="h-3.5 w-3.5"/>
                                {business.contact_email}
                            </span>
                        )}
                    </div>
                </div>
                {isOwner && (
                    <Button asChild variant="outline" size="sm">
                        <Link to={`/businesses/${businessId}/edit`}>
                            <Edit className="h-4 w-4 mr-1"/> Edit
                        </Link>
                    </Button>
                )}
            </div>

            {/* Services */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg">Services</CardTitle>
                    {isOwner && (
                        <Button asChild size="sm">
                            <Link to={`/businesses/${businessId}/services/new`}>
                                <Plus className="h-4 w-4 mr-1"/> Add service
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
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="font-medium text-sm">{service.name}</p>
                                            {!service.active && (
                                                <Badge variant="secondary" className="text-xs">Inactive</Badge>
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
                                        {isOwner && (
                                            <Button asChild variant="ghost" size="sm">
                                                <Link to={`/services/${service.id}/edit`}>
                                                    <Edit className="h-3.5 w-3.5"/>
                                                </Link>
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            No services listed yet.
                            {isOwner && ' Add your first service to start receiving payments.'}
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
