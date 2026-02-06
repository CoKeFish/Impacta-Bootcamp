import {Link, useParams} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {ArrowLeft, Calendar, Loader2, Target, Users} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {Badge} from '@/components/ui/badge';
import {getParticipants, getTrip} from '@/services/api';
import {formatXLM, truncateAddress} from '@/lib/utils';

export function TripDetail() {
    const {id} = useParams<{ id: string }>();
    const tripId = Number(id);

    const {data: trip, isLoading, error} = useQuery({
        queryKey: ['trip', tripId],
        queryFn: () => getTrip(tripId),
        enabled: !isNaN(tripId),
    });

    const {data: participants} = useQuery({
        queryKey: ['participants', tripId],
        queryFn: () => getParticipants(tripId),
        enabled: !isNaN(tripId),
    });

    if (isLoading) {
        return (
            <div className="container py-20 flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/>
            </div>
        );
    }

    if (error || !trip) {
        return (
            <div className="container py-20 text-center">
                <p className="text-destructive">
                    {error?.message ?? 'Trip not found'}
                </p>
                <Button asChild variant="link" className="mt-4">
                    <Link to="/trips">Back to trips</Link>
                </Button>
            </div>
        );
    }

    const collected = parseFloat(trip.total_collected);
    const target = parseFloat(trip.target_amount);
    const progress = target > 0 ? Math.min((collected / target) * 100, 100) : 0;

    return (
        <div className="container py-8 space-y-6 max-w-4xl">
            <Button asChild variant="ghost" size="sm">
                <Link to="/trips">
                    <ArrowLeft className="h-4 w-4 mr-1"/> Back
                </Link>
            </Button>

            {/* Header */}
            <div className="space-y-2">
                <div className="flex items-start justify-between gap-4">
                    <h1 className="text-3xl font-bold tracking-tight">{trip.name}</h1>
                    <Badge variant={trip.status === 'funding' ? 'default' : 'secondary'}>
                        {trip.status}
                    </Badge>
                </div>
                {trip.description && (
                    <p className="text-muted-foreground">{trip.description}</p>
                )}
                <p className="text-sm text-muted-foreground">
                    Organized by {trip.organizer_name ?? truncateAddress(trip.organizer_wallet)}
                </p>
            </div>

            {/* Stats */}
            <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Target className="h-4 w-4"/> Budget
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatXLM(collected)} XLM</div>
                        <p className="text-xs text-muted-foreground">of {formatXLM(target)} XLM target</p>
                        <div className="mt-2 h-2 rounded-full bg-secondary overflow-hidden">
                            <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{width: `${progress}%`}}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Users className="h-4 w-4"/> Participants
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{trip.participant_count}</div>
                        <p className="text-xs text-muted-foreground">min {trip.min_participants} required</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Calendar className="h-4 w-4"/> Deadline
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {new Date(trip.deadline).toLocaleDateString('es', {day: 'numeric', month: 'short'})}
                        </div>
                        <p className="text-xs text-muted-foreground">{trip.penalty_percent}% withdrawal penalty</p>
                    </CardContent>
                </Card>
            </div>

            {/* Participants */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Participants</CardTitle>
                </CardHeader>
                <CardContent>
                    {participants && participants.length > 0 ? (
                        <div className="space-y-3">
                            {participants.map((p) => (
                                <div key={p.id}
                                     className="flex items-center justify-between py-2 border-b last:border-0">
                                    <div>
                    <span className="font-medium text-sm">
                      {p.username ?? truncateAddress(p.wallet_address)}
                    </span>
                                        {p.status === 'withdrawn' && (
                                            <Badge variant="secondary" className="ml-2">withdrawn</Badge>
                                        )}
                                    </div>
                                    <span className="text-sm font-mono">{formatXLM(p.contributed_amount)} XLM</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">No participants yet</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
