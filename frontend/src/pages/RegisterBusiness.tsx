import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useMutation} from '@tanstack/react-query';
import {Loader2, Wallet} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card';
import {createBusiness} from '@/services/api';
import {useAuth} from '@/hooks/useAuth';
import {useWalletStore} from '@/stores/walletStore';

export function RegisterBusiness() {
    const navigate = useNavigate();
    const {isAuthenticated} = useAuth();
    const walletAddress = useWalletStore((s) => s.address);
    const [form, setForm] = useState({
        name: '',
        category: '',
        description: '',
        wallet_address: '',
        contact_email: '',
    });

    const mutation = useMutation({
        mutationFn: () =>
            createBusiness({
                name: form.name,
                category: form.category || undefined,
                description: form.description || undefined,
                wallet_address: form.wallet_address || undefined,
                contact_email: form.contact_email || undefined,
            }),
        onSuccess: (business) => {
            navigate(`/businesses/${business.id}`);
        },
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
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
                <p className="text-muted-foreground">You need to be logged in to register a business.</p>
            </div>
        );
    }

    const inputClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

    return (
        <div className="container py-8 max-w-2xl">
            <Card>
                <CardHeader>
                    <CardTitle>Register your business</CardTitle>
                    <CardDescription>
                        List your business on CoTravel so organizers can include your services in group invoices.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label htmlFor="name" className="text-sm font-medium">Business name *</label>
                            <input id="name" name="name" required value={form.name}
                                   onChange={handleChange} className={inputClass}
                                   placeholder="My Amazing Hotel"/>
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="category" className="text-sm font-medium">Category</label>
                            <select id="category" name="category" value={form.category}
                                    onChange={handleChange} className={inputClass}>
                                <option value="">Select a category</option>
                                <option value="hotel">Hotel</option>
                                <option value="transport">Transport</option>
                                <option value="restaurant">Restaurant</option>
                                <option value="experience">Experience</option>
                                <option value="other">Other</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="description" className="text-sm font-medium">Description</label>
                            <textarea id="description" name="description" value={form.description}
                                      onChange={handleChange} rows={3}
                                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                      placeholder="Tell organizers about your business..."/>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label htmlFor="wallet_address" className="text-sm font-medium">Stellar wallet
                                    address</label>
                                {walletAddress && walletAddress !== form.wallet_address && (
                                    <button
                                        type="button"
                                        onClick={() => setForm((prev) => ({...prev, wallet_address: walletAddress}))}
                                        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                                    >
                                        <Wallet className="h-3 w-3"/>
                                        Use this wallet
                                    </button>
                                )}
                            </div>
                            <input id="wallet_address" name="wallet_address" value={form.wallet_address}
                                   onChange={handleChange} className={inputClass}
                                   placeholder="G... (where you'll receive payments)"/>
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="contact_email" className="text-sm font-medium">Contact email</label>
                            <input id="contact_email" name="contact_email" type="email"
                                   value={form.contact_email} onChange={handleChange}
                                   className={inputClass} placeholder="contact@business.com"/>
                        </div>

                        {mutation.error && (
                            <div
                                className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                                {mutation.error.message}
                            </div>
                        )}

                        <Button type="submit" className="w-full" disabled={mutation.isPending}>
                            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin"/>}
                            {mutation.isPending ? 'Registering...' : 'Register business'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
