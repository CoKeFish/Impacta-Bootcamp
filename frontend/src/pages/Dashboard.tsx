import {useQuery} from '@tanstack/react-query';
import {Link} from 'react-router-dom';
import {Loader2, Plus} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardFooter, CardHeader, CardTitle} from '@/components/ui/card';
import {Badge} from '@/components/ui/badge';
import {getTrips} from '@/services/api';
import {formatXLM} from '@/lib/utils';
import type {Trip} from '@/types';

const statusVariant: Record<string, 'default' | 'secondary' | 'success' | 'destructive' | 'warning'> = {
    draft: 'secondary',
    funding: 'default',
    completed: 'success',
    released: 'success',
    cancelled: 'destructive',
};

function TripCard({trip}: { trip: Trip }) {
    const collected = parseFloat(trip.total_collected);
    const target = parseFloat(trip.target_amount);
    const progress = target > 0 ? Math.min((collected / target) * 100, 100) : 0;

    return (
        <Link to={`/trips/${trip.id}`} className="block">
            <Card className="h-full transition-shadow hover:shadow-md">
                <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-lg line-clamp-1">{trip.name}</CardTitle>
                        <Badge variant={statusVariant[trip.status] ?? 'secondary'}>
                            {trip.status}
                        </Badge>
                    </div>
                    {trip.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{trip.description}</p>
                    )}
                </CardHeader>
                <CardContent className="pb-3">
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Collected</span>
                            <span className="font-medium">
                {formatXLM(collected)} / {formatXLM(target)} XLM
              </span>
                        </div>
                        <div className="h-2 rounded-full bg-secondary overflow-hidden">
                            <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{width: `${progress}%`}}
                            />
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="text-xs text-muted-foreground justify-between">
                    <span>{trip.participant_count} participants</span>
                    <span>by {trip.organizer_name ?? trip.organizer_wallet.slice(0, 8) + '...'}</span>
                </CardFooter>
            </Card>
        </Link>
    );
}

export function Dashboard() {
    const {data: trips, isLoading, error} = useQuery({
        queryKey: ['trips'],
        queryFn: getTrips,
    });

    return (
        <div className="container py-8 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Trips</h1>
                    <p className="text-muted-foreground">Browse and join group travel budgets</p>
                </div>
                <Button asChild>
                    <Link to="/trips/new">
                        <Plus className="h-4 w-4"/> New trip
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
                    Failed to load trips: {error.message}
                </div>
            )}

            {trips && trips.length === 0 && (
                <div className="text-center py-20 text-muted-foreground">
                    No trips yet. Be the first to create one!
                </div>
            )}

            {trips && trips.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {trips.map((trip) => (
                        <TripCard key={trip.id} trip={trip}/>
                    ))}
                </div>
            )}
        </div>
    );
}
