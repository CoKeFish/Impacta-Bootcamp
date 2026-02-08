import {useEffect, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {Loader2} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card';
import {getBusiness, updateBusiness} from '@/services/api';
import {useAuth} from '@/hooks/useAuth';

export function EditBusiness() {
    const {id} = useParams<{ id: string }>();
    const businessId = Number(id);
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const {isAuthenticated} = useAuth();

    const {data: business, isLoading: loadingBusiness} = useQuery({
        queryKey: ['business', businessId],
        queryFn: () => getBusiness(businessId),
        enabled: !isNaN(businessId),
    });

    const [form, setForm] = useState({
        name: '',
        category: '',
        description: '',
        wallet_address: '',
        contact_email: '',
    });

    useEffect(() => {
        if (business) {
            setForm({
                name: business.name,
                category: business.category ?? '',
                description: business.description ?? '',
                wallet_address: business.wallet_address ?? '',
                contact_email: business.contact_email ?? '',
            });
        }
    }, [business]);

    const mutation = useMutation({
        mutationFn: () => updateBusiness(businessId, {
            name: form.name,
            category: form.category || undefined,
            description: form.description || undefined,
            wallet_address: form.wallet_address || undefined,
            contact_email: form.contact_email || undefined,
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['business', businessId]});
            queryClient.invalidateQueries({queryKey: ['myBusinesses']});
            navigate(`/businesses/${businessId}`);
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

    if (loadingBusiness) {
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
                    <CardTitle>Edit Business</CardTitle>
                    <CardDescription>Update your business information.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        mutation.mutate();
                    }} className="space-y-4">
                        <div className="space-y-2">
                            <label htmlFor="name" className="text-sm font-medium">Business name *</label>
                            <input id="name" name="name" required value={form.name} onChange={handleChange}
                                   className={inputClass}/>
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="category" className="text-sm font-medium">Category</label>
                            <input id="category" name="category" value={form.category} onChange={handleChange}
                                   className={inputClass} placeholder="e.g. Travel, Food, Transport"/>
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="description" className="text-sm font-medium">Description</label>
                            <textarea id="description" name="description" value={form.description}
                                      onChange={handleChange} rows={3}
                                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"/>
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="wallet_address" className="text-sm font-medium">Payment wallet
                                (Stellar)</label>
                            <input id="wallet_address" name="wallet_address" value={form.wallet_address}
                                   onChange={handleChange} className={inputClass} placeholder="G..."/>
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="contact_email" className="text-sm font-medium">Contact email</label>
                            <input id="contact_email" name="contact_email" type="email" value={form.contact_email}
                                   onChange={handleChange} className={inputClass}/>
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
