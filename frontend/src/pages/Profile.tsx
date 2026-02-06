import {useQuery} from '@tanstack/react-query';
import {Calendar, Loader2, User} from 'lucide-react';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {useAuth} from '@/hooks/useAuth';
import {getTrips} from '@/services/api';
import {truncateAddress} from '@/lib/utils';
import {Link} from 'react-router-dom';
import {Badge} from '@/components/ui/badge';

export function Profile() {
    const {isAuthenticated, user, address} = useAuth();

    const {data: trips, isLoading} = useQuery({
        queryKey: ['trips'],
        queryFn: getTrips,
        enabled: isAuthenticated,
    });

    if (!isAuthenticated || !user) {
        return (
            <div className="container py-20 text-center">
                <h2 className="text-2xl font-bold mb-2">Connect your wallet</h2>
                <p className="text-muted-foreground">You need to be logged in to view your profile.</p>
            </div>
        );
    }

    const myTrips = trips?.filter(
        (t) => t.organizer_wallet === address,
    );

    const participating = trips?.filter(
        (t) => t.organizer_wallet !== address,
    );

    return (
        <div className="container py-8 max-w-3xl space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5"/> Profile
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Wallet</span>
                        <span className="text-sm font-mono">{address ? truncateAddress(address, 8) : '-'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Username</span>
                        <span className="text-sm">{user.username ?? 'Not set'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Joined</span>
                        <span className="text-sm flex items-center gap-1">
              <Calendar className="h-3 w-3"/>
                            {new Date(user.created_at).toLocaleDateString()}
            </span>
                    </div>
                </CardContent>
            </Card>

            {isLoading && (
                <div className="flex justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground"/>
                </div>
            )}

            {myTrips && myTrips.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">My trips (organizer)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {myTrips.map((t) => (
                            <Link key={t.id} to={`/trips/${t.id}`}
                                  className="flex items-center justify-between py-2 border-b last:border-0 hover:bg-muted/50 -mx-2 px-2 rounded">
                                <span className="font-medium text-sm">{t.name}</span>
                                <Badge variant="secondary">{t.status}</Badge>
                            </Link>
                        ))}
                    </CardContent>
                </Card>
            )}

            {participating && participating.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Participating in</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {participating.map((t) => (
                            <Link key={t.id} to={`/trips/${t.id}`}
                                  className="flex items-center justify-between py-2 border-b last:border-0 hover:bg-muted/50 -mx-2 px-2 rounded">
                                <span className="font-medium text-sm">{t.name}</span>
                                <Badge variant="secondary">{t.status}</Badge>
                            </Link>
                        ))}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
