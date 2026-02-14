import {useEffect, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {Loader2} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card';
import {ImagePicker} from '@/components/ui/image-picker';
import {getBusiness, updateBusiness} from '@/services/api';
import {useAuth} from '@/hooks/useAuth';

export function EditBusiness() {
    const {t} = useTranslation('businesses');
    const {t: tc} = useTranslation();
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
        logo_url: '',
        category: '',
        description: '',
        wallet_address: '',
        contact_email: '',
    });

    useEffect(() => {
        if (business) {
            setForm({
                name: business.name,
                logo_url: business.logo_url ?? '',
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
            logo_url: form.logo_url || undefined,
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
                <h2 className="text-2xl font-bold mb-2">{tc('auth.connectWallet')}</h2>
                <p className="text-muted-foreground">{tc('auth.loginRequired', {action: t('edit.title').toLowerCase()})}</p>
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
                    <CardTitle>{t('edit.title')}</CardTitle>
                    <CardDescription>{t('edit.subtitle')}</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        mutation.mutate();
                    }} className="space-y-4">
                        <div className="space-y-2">
                            <label htmlFor="name" className="text-sm font-medium">{t('register.nameLabel')}</label>
                            <input id="name" name="name" required value={form.name} onChange={handleChange}
                                   className={inputClass}/>
                        </div>
                        <ImagePicker
                            label={tc('image.logoLabel')}
                            value={form.logo_url || null}
                            onChange={(url) => setForm((prev) => ({...prev, logo_url: url ?? ''}))}
                        />

                        <div className="space-y-2">
                            <label htmlFor="category"
                                   className="text-sm font-medium">{t('register.categoryLabel')}</label>
                            <input id="category" name="category" value={form.category} onChange={handleChange}
                                   className={inputClass} placeholder={t('edit.categoryPlaceholder')}/>
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="description"
                                   className="text-sm font-medium">{t('register.descriptionLabel')}</label>
                            <textarea id="description" name="description" value={form.description}
                                      onChange={handleChange} rows={3}
                                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"/>
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="wallet_address"
                                   className="text-sm font-medium">{t('edit.paymentWalletLabel')}</label>
                            <input id="wallet_address" name="wallet_address" value={form.wallet_address}
                                   onChange={handleChange} className={inputClass}
                                   placeholder={t('edit.walletPlaceholder')}/>
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="contact_email"
                                   className="text-sm font-medium">{t('register.emailLabel')}</label>
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
                            <Button type="button" variant="outline"
                                    onClick={() => navigate(-1)}>{tc('buttons.cancel')}</Button>
                            <Button type="submit" disabled={mutation.isPending}>
                                {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1"/>}
                                {tc('buttons.save')}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
