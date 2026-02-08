import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useMutation} from '@tanstack/react-query';
import {Loader2, Wallet} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card';
import {createBusiness} from '@/services/api';
import {useAuth} from '@/hooks/useAuth';
import {useWalletStore} from '@/stores/walletStore';

export function RegisterBusiness() {
    const {t} = useTranslation('businesses');
    const {t: tc} = useTranslation();
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
                <h2 className="text-2xl font-bold mb-2">{tc('auth.connectWallet')}</h2>
                <p className="text-muted-foreground">{tc('auth.loginRequired', {action: t('register.title').toLowerCase()})}</p>
            </div>
        );
    }

    const inputClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

    return (
        <div className="container py-8 max-w-2xl">
            <Card>
                <CardHeader>
                    <CardTitle>{t('register.title')}</CardTitle>
                    <CardDescription>
                        {t('register.subtitle')}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label htmlFor="name" className="text-sm font-medium">{t('register.nameLabel')}</label>
                            <input id="name" name="name" required value={form.name}
                                   onChange={handleChange} className={inputClass}
                                   placeholder={t('register.namePlaceholder')}/>
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="category"
                                   className="text-sm font-medium">{t('register.categoryLabel')}</label>
                            <select id="category" name="category" value={form.category}
                                    onChange={handleChange} className={inputClass}>
                                <option value="">{t('register.categoryPlaceholder')}</option>
                                <option value="hotel">{t('register.categoryHotel')}</option>
                                <option value="transport">{t('register.categoryTransport')}</option>
                                <option value="restaurant">{t('register.categoryRestaurant')}</option>
                                <option value="experience">{t('register.categoryExperience')}</option>
                                <option value="other">{t('register.categoryOther')}</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="description"
                                   className="text-sm font-medium">{t('register.descriptionLabel')}</label>
                            <textarea id="description" name="description" value={form.description}
                                      onChange={handleChange} rows={3}
                                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                      placeholder={t('register.descriptionPlaceholder')}/>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label htmlFor="wallet_address"
                                       className="text-sm font-medium">{t('register.walletLabel')}</label>
                                {walletAddress && walletAddress !== form.wallet_address && (
                                    <button
                                        type="button"
                                        onClick={() => setForm((prev) => ({...prev, wallet_address: walletAddress}))}
                                        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                                    >
                                        <Wallet className="h-3 w-3"/>
                                        {t('register.useThisWallet')}
                                    </button>
                                )}
                            </div>
                            <input id="wallet_address" name="wallet_address" value={form.wallet_address}
                                   onChange={handleChange} className={inputClass}
                                   placeholder={t('register.walletPlaceholder')}/>
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="contact_email"
                                   className="text-sm font-medium">{t('register.emailLabel')}</label>
                            <input id="contact_email" name="contact_email" type="email"
                                   value={form.contact_email} onChange={handleChange}
                                   className={inputClass} placeholder={t('register.emailPlaceholder')}/>
                        </div>

                        {mutation.error && (
                            <div
                                className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                                {mutation.error.message}
                            </div>
                        )}

                        <Button type="submit" className="w-full" disabled={mutation.isPending}>
                            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin"/>}
                            {mutation.isPending ? t('register.registering') : t('register.registerButton')}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
