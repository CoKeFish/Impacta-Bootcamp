import {useEffect, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {Loader2} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card';
import {getService, updateService} from '@/services/api';
import {useAuth} from '@/hooks/useAuth';

export function EditService() {
    const {id} = useParams<{ id: string }>();
    const serviceId = Number(id);
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const {isAuthenticated} = useAuth();

    const {data: service, isLoading} = useQuery({
        queryKey: ['service', serviceId],
        queryFn: () => getService(serviceId),
        enabled: !isNaN(serviceId),
    });

    const [form, setForm] = useState({
        name: '',
        description: '',
        price: '',
    });

    useEffect(() => {
        if (service) {
            setForm({
                name: service.name,
                description: service.description ?? '',
                price: service.price,
            });
        }
    }, [service]);

    const mutation = useMutation({
        mutationFn: () => updateService(serviceId, {
            name: form.name,
            description: form.description || undefined,
            price: parseFloat(form.price),
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['service', serviceId]});
            queryClient.invalidateQueries({queryKey: ['services']});
            navigate(-1);
        },
    });

    if (!isAuthenticated) {
        return (
            <div className="container py-20 text-center">
                <h2 className="text-2xl font-bold mb-2">Connect your wallet</h2>
                <p className="text-muted-foreground">You need to be logged in.</p>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="container py-20 flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/>
            </div>
        );
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setForm((prev) => ({...prev, [e.target.name]: e.target.value}));
    };

    const inputClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

    return (
        <div className="container py-8 max-w-2xl">
            <Card>
                <CardHeader>
                    <CardTitle>Edit Service</CardTitle>
                    <CardDescription>Update service details.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        mutation.mutate();
                    }} className="space-y-4">
                        <div className="space-y-2">
                            <label htmlFor="name" className="text-sm font-medium">Service name *</label>
                            <input id="name" name="name" required value={form.name} onChange={handleChange}
                                   className={inputClass}/>
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="description" className="text-sm font-medium">Description</label>
                            <textarea id="description" name="description" value={form.description}
                                      onChange={handleChange}
                                      rows={3}
                                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"/>
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="price" className="text-sm font-medium">Price (XLM) *</label>
                            <input id="price" name="price" type="number" min="0" step="0.0000001" required
                                   value={form.price} onChange={handleChange} className={inputClass}/>
                        </div>

                        {mutation.error && (
                            <div
                                className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                                {mutation.error.message}
                            </div>
                        )}

                        <div className="flex gap-3">
                            <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
                            <Button type="submit" disabled={mutation.isPending}>
                                {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1"/>}
                                Save changes
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
