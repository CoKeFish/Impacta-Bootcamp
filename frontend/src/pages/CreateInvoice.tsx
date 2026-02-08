import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useMutation} from '@tanstack/react-query';
import {Loader2, Trash2} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card';
import {ServicePicker} from '@/components/invoice/ServicePicker';
import {createInvoice} from '@/services/api';
import {useAuth} from '@/hooks/useAuth';
import {formatXLM} from '@/lib/utils';
import type {Service} from '@/types';

interface DraftItem {
    key: string;
    service_id?: number;
    description: string;
    amount: string;
    recipient_wallet: string;
}

const ICON_OPTIONS = ['', '🏨', '✈️', '🚗', '🍽️', '🎫', '🏖️', '💼', '🎓', '🏥', '📦'];

export function CreateInvoice() {
    const navigate = useNavigate();
    const {isAuthenticated} = useAuth();
    const {t} = useTranslation('invoices');
    const {t: tc} = useTranslation();
    const [form, setForm] = useState({
        name: '',
        description: '',
        min_participants: '2',
        penalty_percent: '0',
        deadline: '',
        icon: '',
        auto_release: false,
    });
    const [items, setItems] = useState<DraftItem[]>([]);
    const [showPicker, setShowPicker] = useState(false);

    const totalAmount = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

    const mutation = useMutation({
        mutationFn: () =>
            createInvoice({
                name: form.name,
                description: form.description || undefined,
                items: items.map((item, idx) => ({
                    service_id: item.service_id,
                    description: item.description,
                    amount: parseFloat(item.amount),
                    recipient_wallet: item.recipient_wallet || undefined,
                    sort_order: idx,
                })),
                min_participants: Number(form.min_participants),
                penalty_percent: Number(form.penalty_percent),
                deadline: new Date(form.deadline).toISOString(),
                icon: form.icon || undefined,
                auto_release: form.auto_release,
            }),
        onSuccess: (invoice) => {
            navigate(`/invoices/${invoice.id}`);
        },
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const {name, value, type} = e.target;
        setForm((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
        }));
    };

    const handleAddService = (service: Service) => {
        setItems((prev) => [
            ...prev,
            {
                key: `${service.id}-${Date.now()}`,
                service_id: service.id,
                description: `${service.name} (${service.business_name})`,
                amount: service.price,
                recipient_wallet: service.business_wallet || '',
            },
        ]);
        setShowPicker(false);
    };

    const handleAddCustomItem = () => {
        setItems((prev) => [
            ...prev,
            {
                key: `custom-${Date.now()}`,
                description: '',
                amount: '',
                recipient_wallet: '',
            },
        ]);
    };

    const handleRemoveItem = (key: string) => {
        setItems((prev) => prev.filter((item) => item.key !== key));
    };

    const handleItemChange = (key: string, field: string, value: string) => {
        setItems((prev) =>
            prev.map((item) => (item.key === key ? {...item, [field]: value} : item)),
        );
    };

    const [validationErrors, setValidationErrors] = useState<string[]>([]);

    const validate = (): string[] => {
        const errors: string[] = [];
        if (!form.name.trim()) errors.push(t('create.validation.nameRequired'));
        if (!form.deadline) errors.push(t('create.validation.deadlineRequired'));
        else if (new Date(form.deadline) <= new Date()) errors.push(t('create.validation.deadlineFuture'));
        if (items.length === 0) errors.push(t('create.validation.itemsRequired'));
        for (const item of items) {
            if (!item.description.trim()) {
                errors.push(t('create.validation.itemDescriptionRequired'));
                break;
            }
            if (!item.amount || parseFloat(item.amount) <= 0) {
                errors.push(t('create.validation.itemAmountRequired'));
                break;
            }
        }
        return errors;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const errors = validate();
        setValidationErrors(errors);
        if (errors.length > 0) return;
        mutation.mutate();
    };

    if (!isAuthenticated) {
        return (
            <div className="container py-20 text-center">
                <h2 className="text-2xl font-bold mb-2">{tc('auth.connectWallet')}</h2>
                <p className="text-muted-foreground">{tc('auth.loginRequired', {action: t('create.title').toLowerCase()})}</p>
            </div>
        );
    }

    const inputClass =
        'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

    return (
        <div className="container py-8 max-w-3xl space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>{t('create.title')}</CardTitle>
                    <CardDescription>
                        {t('create.subtitle')}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Basic info */}
                        <div className="space-y-4">
                            <div className="flex gap-3">
                                <div className="space-y-2 w-20">
                                    <label htmlFor="icon"
                                           className="text-sm font-medium">{t('create.iconLabel')}</label>
                                    <select
                                        id="icon"
                                        name="icon"
                                        value={form.icon}
                                        onChange={handleChange}
                                        className={inputClass}
                                    >
                                        {ICON_OPTIONS.map((icon) => (
                                            <option key={icon} value={icon}>
                                                {icon || '–'}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2 flex-1">
                                    <label htmlFor="name" className="text-sm font-medium">
                                        {t('create.nameLabel')}
                                    </label>
                                    <input
                                        id="name"
                                        name="name"
                                        required
                                        value={form.name}
                                        onChange={handleChange}
                                        className={inputClass}
                                        placeholder={t('create.namePlaceholder')}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="description" className="text-sm font-medium">
                                    {t('create.descriptionLabel')}
                                </label>
                                <textarea
                                    id="description"
                                    name="description"
                                    value={form.description}
                                    onChange={handleChange}
                                    rows={2}
                                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    placeholder={t('create.descriptionPlaceholder')}
                                />
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <div className="space-y-2">
                                    <label htmlFor="min_participants" className="text-sm font-medium">
                                        {t('create.minParticipantsLabel')}
                                    </label>
                                    <input
                                        id="min_participants"
                                        name="min_participants"
                                        type="number"
                                        min="1"
                                        value={form.min_participants}
                                        onChange={handleChange}
                                        className={inputClass}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="penalty_percent" className="text-sm font-medium">
                                        {t('create.penaltyLabel')}
                                    </label>
                                    <input
                                        id="penalty_percent"
                                        name="penalty_percent"
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={form.penalty_percent}
                                        onChange={handleChange}
                                        className={inputClass}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="deadline" className="text-sm font-medium">
                                        {t('create.deadlineLabel')}
                                    </label>
                                    <input
                                        id="deadline"
                                        name="deadline"
                                        type="date"
                                        required
                                        min={new Date().toISOString().split('T')[0]}
                                        value={form.deadline}
                                        onChange={handleChange}
                                        className={inputClass}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">{t('create.autoReleaseLabel')}</label>
                                    <div className="flex items-center h-10 gap-2">
                                        <input
                                            id="auto_release"
                                            name="auto_release"
                                            type="checkbox"
                                            checked={form.auto_release}
                                            onChange={handleChange}
                                            className="h-4 w-4 rounded border-input"
                                        />
                                        <label htmlFor="auto_release" className="text-sm text-muted-foreground">
                                            {t('create.payWhenFunded')}
                                        </label>
                                    </div>
                                </div>
                            </div>
                            {!form.auto_release && (
                                <p className="text-xs text-muted-foreground">
                                    {t('create.confirmReleaseNote')}
                                </p>
                            )}
                        </div>

                        {/* Items */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-medium">{t('create.itemsLabel')}</h3>
                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setShowPicker(!showPicker)}
                                    >
                                        {showPicker ? t('create.hideCatalog') : t('create.fromCatalog')}
                                    </Button>
                                    <Button type="button" size="sm" variant="outline" onClick={handleAddCustomItem}>
                                        {t('create.customItem')}
                                    </Button>
                                </div>
                            </div>

                            {showPicker && (
                                <Card>
                                    <CardContent className="pt-4">
                                        <ServicePicker onSelect={handleAddService}/>
                                    </CardContent>
                                </Card>
                            )}

                            {items.length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                    {t('create.noItems')}
                                </p>
                            )}

                            {items.map((item) => (
                                <div key={item.key} className="flex gap-2 items-start p-3 rounded-lg border">
                                    <div className="flex-1 space-y-2">
                                        <input
                                            placeholder={t('create.descriptionItemPlaceholder')}
                                            value={item.description}
                                            onChange={(e) =>
                                                handleItemChange(item.key, 'description', e.target.value)
                                            }
                                            className={inputClass}
                                        />
                                        <div className="grid grid-cols-2 gap-2">
                                            <input
                                                placeholder={t('create.amountPlaceholder')}
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={item.amount}
                                                onChange={(e) =>
                                                    handleItemChange(item.key, 'amount', e.target.value)
                                                }
                                                className={inputClass}
                                            />
                                            <input
                                                placeholder={t('create.recipientPlaceholder')}
                                                value={item.recipient_wallet}
                                                onChange={(e) =>
                                                    handleItemChange(item.key, 'recipient_wallet', e.target.value)
                                                }
                                                readOnly={!!item.service_id}
                                                className={`${inputClass}${item.service_id ? ' opacity-50' : ''}`}
                                            />
                                        </div>
                                    </div>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleRemoveItem(item.key)}
                                    >
                                        <Trash2 className="h-4 w-4 text-destructive"/>
                                    </Button>
                                </div>
                            ))}

                            {items.length > 0 && (
                                <div className="flex justify-end text-sm font-medium pt-2 border-t">
                                    {t('create.total', {amount: formatXLM(totalAmount)})}
                                </div>
                            )}
                        </div>

                        {validationErrors.length > 0 && (
                            <div
                                className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive space-y-1">
                                {validationErrors.map((err, i) => (
                                    <p key={i}>{err}</p>
                                ))}
                            </div>
                        )}

                        {mutation.error && (
                            <div
                                className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                                {mutation.error.message}
                            </div>
                        )}

                        <Button type="submit" className="w-full" disabled={mutation.isPending}>
                            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin"/>}
                            {mutation.isPending ? t('create.creating') : t('create.createButton', {amount: formatXLM(totalAmount)})}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
