import {useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {Loader2} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card';
import {createService, getBusiness} from '@/services/api';
import {useAuth} from '@/hooks/useAuth';

export function AddService() {
    const {t} = useTranslation('services');
    const {t: tc} = useTranslation();
    const {id} = useParams<{ id: string }>();
    const businessId = Number(id);
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const {isAuthenticated} = useAuth();

    const {data: business} = useQuery({
        queryKey: ['business', businessId],
        queryFn: () => getBusiness(businessId),
        enabled: !isNaN(businessId),
    });

    const [form, setForm] = useState({
        name: '',
        description: '',
        price: '',
    });

    const mutation = useMutation({
        mutationFn: () =>
            createService({
                business_id: businessId,
                name: form.name,
                description: form.description || undefined,
                price: parseFloat(form.price),
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['businessServices', businessId]});
            navigate(`/businesses/${businessId}`);
        },
    });

    if (!isAuthenticated) {
        return (
            <div className="container py-20 text-center">
                <h2 className="text-2xl font-bold mb-2">{tc('auth.connectWallet')}</h2>
                <p className="text-muted-foreground">{tc('auth.loginRequired', {action: t('add.title').toLowerCase()})}</p>
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
                    <CardTitle>{t('add.title')}</CardTitle>
                    <CardDescription>
                        {t('add.title')} - {business?.name ?? `business #${businessId}`}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        mutation.mutate();
                    }} className="space-y-4">
                        <div className="space-y-2">
                            <label htmlFor="name" className="text-sm font-medium">{t('add.nameLabel')}</label>
                            <input id="name" name="name" required value={form.name} onChange={handleChange}
                                   className={inputClass} placeholder={t('add.namePlaceholder')}/>
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="description"
                                   className="text-sm font-medium">{t('add.descriptionLabel')}</label>
                            <textarea id="description" name="description" value={form.description}
                                      onChange={handleChange}
                                      rows={3}
                                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                      placeholder={t('add.descriptionPlaceholder')}/>
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="price" className="text-sm font-medium">{t('add.priceLabel')}</label>
                            <input id="price" name="price" type="number" min="0" step="0.0000001" required
                                   value={form.price} onChange={handleChange} className={inputClass}
                                   placeholder={t('add.pricePlaceholder')}/>
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
                            <Button type="submit" disabled={mutation.isPending || !form.name || !form.price}>
                                {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1"/>}
                                {mutation.isPending ? t('add.creating') : t('add.createButton')}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
