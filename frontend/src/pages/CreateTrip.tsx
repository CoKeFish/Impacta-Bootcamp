import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useMutation} from '@tanstack/react-query';
import {Loader2} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card';
import {createTrip} from '@/services/api';
import {useAuth} from '@/hooks/useAuth';

export function CreateTrip() {
    const navigate = useNavigate();
    const {isAuthenticated} = useAuth();
    const [form, setForm] = useState({
        name: '',
        description: '',
        target_amount: '',
        min_participants: '2',
        penalty_percent: '10',
        deadline: '',
    });

    const mutation = useMutation({
        mutationFn: () =>
            createTrip({
                name: form.name,
                description: form.description || undefined,
                target_amount: Number(form.target_amount),
                min_participants: Number(form.min_participants),
                penalty_percent: Number(form.penalty_percent),
                deadline: new Date(form.deadline).toISOString(),
            }),
        onSuccess: (trip) => {
            navigate(`/trips/${trip.id}`);
        },
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setForm((prev) => ({...prev, [e.target.name]: e.target.value}));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        mutation.mutate();
    };

    if (!isAuthenticated) {
        return (
            <div className="container py-20 text-center">
                <h2 className="text-2xl font-bold mb-2">Connect your wallet</h2>
                <p className="text-muted-foreground">You need to be logged in to create a trip.</p>
            </div>
        );
    }

    return (
        <div className="container py-8 max-w-2xl">
            <Card>
                <CardHeader>
                    <CardTitle>Create a new trip</CardTitle>
                    <CardDescription>Set up your group travel budget. You can link it to the smart contract after
                        creation.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label htmlFor="name" className="text-sm font-medium">Trip name *</label>
                            <input
                                id="name"
                                name="name"
                                required
                                value={form.name}
                                onChange={handleChange}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                placeholder="Summer trip to Barcelona"
                            />
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="description" className="text-sm font-medium">Description</label>
                            <textarea
                                id="description"
                                name="description"
                                value={form.description}
                                onChange={handleChange}
                                rows={3}
                                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                placeholder="What's the plan?"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label htmlFor="target_amount" className="text-sm font-medium">Target (XLM) *</label>
                                <input
                                    id="target_amount"
                                    name="target_amount"
                                    type="number"
                                    required
                                    min="1"
                                    step="0.01"
                                    value={form.target_amount}
                                    onChange={handleChange}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    placeholder="1000"
                                />
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="min_participants" className="text-sm font-medium">Min participants
                                    *</label>
                                <input
                                    id="min_participants"
                                    name="min_participants"
                                    type="number"
                                    required
                                    min="2"
                                    value={form.min_participants}
                                    onChange={handleChange}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label htmlFor="penalty_percent" className="text-sm font-medium">Penalty %</label>
                                <input
                                    id="penalty_percent"
                                    name="penalty_percent"
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={form.penalty_percent}
                                    onChange={handleChange}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                />
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="deadline" className="text-sm font-medium">Deadline *</label>
                                <input
                                    id="deadline"
                                    name="deadline"
                                    type="date"
                                    required
                                    value={form.deadline}
                                    onChange={handleChange}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                />
                            </div>
                        </div>

                        {mutation.error && (
                            <div
                                className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                                {mutation.error.message}
                            </div>
                        )}

                        <Button type="submit" className="w-full" disabled={mutation.isPending}>
                            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin"/>}
                            {mutation.isPending ? 'Creating...' : 'Create trip'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
