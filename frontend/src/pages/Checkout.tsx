import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {Loader2, Minus, Plus, ShoppingCart, Trash2} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {EmptyState} from '@/components/ui/empty-state';
import {PageHeader} from '@/components/ui/page-header';
import {formatXLM} from '@/lib/utils';
import {useCart} from '@/hooks/useCart';
import {useAuth} from '@/hooks/useAuth';

const ICONS = ['🌴', '✈️', '🏨', '🎉', '🍽️', '🚐', '🎭', '🏖️', '⛷️', '🚀'];

export function Checkout() {
    const {t} = useTranslation('cart');
    const {t: tc} = useTranslation();
    const navigate = useNavigate();
    const {isAuthenticated} = useAuth();
    const {items, isLoading, updateItem, removeItem, clear, checkout} = useCart();

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [icon, setIcon] = useState('🌴');
    const [deadline, setDeadline] = useState('');
    const [minParticipants, setMinParticipants] = useState(1);
    const [penaltyPercent, setPenaltyPercent] = useState(10);
    const [autoRelease, setAutoRelease] = useState(false);

    if (!isAuthenticated) {
        return (
            <div className="container py-20 text-center">
                <p className="text-muted-foreground">{tc('auth.loginRequired', {action: t('title').toLowerCase()})}</p>
            </div>
        );
    }

    const total = items.reduce((sum, item) => sum + parseFloat(item.price) * item.quantity, 0);

    const handleCheckout = async () => {
        const result = await checkout.mutateAsync({
            name,
            description: description || undefined,
            icon,
            deadline: new Date(deadline).toISOString(),
            min_participants: minParticipants,
            penalty_percent: penaltyPercent,
            auto_release: autoRelease,
        });
        navigate(`/invoices/${result.id}`);
    };

    if (isLoading) {
        return (
            <div className="container py-20 flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/>
            </div>
        );
    }

    return (
        <div className="flex flex-col">
            <PageHeader title={t('title')} subtitle={t('subtitle')}/>

            <div className="container py-8 max-w-4xl space-y-6">
                {items.length === 0 ? (
                    <EmptyState
                        icon={ShoppingCart}
                        title={t('empty')}
                        description={t('emptyDescription')}
                        actionLabel={t('browseCatalog')}
                        actionHref="/services"
                    />
                ) : (
                    <>
                        {/* Cart Items */}
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle className="text-lg">{t('items')} ({items.length})</CardTitle>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => clear.mutate()}
                                    disabled={clear.isPending}
                                >
                                    <Trash2 className="h-4 w-4 mr-1"/>
                                    {t('clearCart')}
                                </Button>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {items.map((item) => (
                                        <div key={item.id}
                                             className="flex items-center gap-3 py-3 border-b last:border-0">
                                            {item.image_url ? (
                                                <img
                                                    src={item.image_url}
                                                    alt={item.service_name}
                                                    className="h-12 w-12 rounded object-cover border flex-shrink-0"
                                                />
                                            ) : (
                                                <div
                                                    className="h-12 w-12 rounded border flex items-center justify-center bg-muted flex-shrink-0">
                                                    <ShoppingCart className="h-5 w-5 text-muted-foreground"/>
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-sm truncate">{item.service_name}</p>
                                                <p className="text-xs text-muted-foreground">{item.business_name}</p>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    onClick={() => {
                                                        if (item.quantity > 1) {
                                                            updateItem.mutate({
                                                                id: item.id,
                                                                quantity: item.quantity - 1
                                                            });
                                                        }
                                                    }}
                                                    disabled={item.quantity <= 1}
                                                >
                                                    <Minus className="h-3 w-3"/>
                                                </Button>
                                                <span className="w-8 text-center text-sm font-medium">
                                                    {item.quantity}
                                                </span>
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    onClick={() => updateItem.mutate({
                                                        id: item.id,
                                                        quantity: item.quantity + 1
                                                    })}
                                                >
                                                    <Plus className="h-3 w-3"/>
                                                </Button>
                                            </div>
                                            <span className="text-sm font-mono w-24 text-right">
                                                {formatXLM(String(parseFloat(item.price) * item.quantity))} XLM
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                onClick={() => removeItem.mutate(item.id)}
                                            >
                                                <Trash2 className="h-3.5 w-3.5"/>
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex justify-end pt-4 border-t mt-4">
                                    <div className="text-right">
                                        <span className="text-sm text-muted-foreground">{t('total')}: </span>
                                        <span
                                            className="text-lg font-bold font-mono">{formatXLM(String(total))} XLM</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Invoice Config */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">{t('invoiceConfig')}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">{t('invoiceName')} *</label>
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder={t('invoiceNamePlaceholder')}
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">{t('deadline')} *</label>
                                        <input
                                            type="datetime-local"
                                            value={deadline}
                                            onChange={(e) => setDeadline(e.target.value)}
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">{t('descriptionLabel')}</label>
                                    <input
                                        type="text"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder={t('descriptionPlaceholder')}
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">{t('icon')}</label>
                                    <div className="flex gap-1.5 flex-wrap">
                                        {ICONS.map((emoji) => (
                                            <button
                                                key={emoji}
                                                type="button"
                                                onClick={() => setIcon(emoji)}
                                                className={`h-9 w-9 rounded-md border text-lg flex items-center justify-center transition-colors ${
                                                    icon === emoji
                                                        ? 'border-primary bg-primary/10'
                                                        : 'border-input hover:bg-muted'
                                                }`}
                                            >
                                                {emoji}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid gap-4 sm:grid-cols-3">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">{t('minParticipants')}</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={minParticipants}
                                            onChange={(e) => setMinParticipants(Number(e.target.value))}
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">{t('penaltyPercent')}</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={penaltyPercent}
                                            onChange={(e) => setPenaltyPercent(Number(e.target.value))}
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                        />
                                    </div>
                                    <div className="flex items-end pb-1">
                                        <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={autoRelease}
                                                onChange={(e) => setAutoRelease(e.target.checked)}
                                                className="rounded border-input"
                                            />
                                            {t('autoRelease')}
                                        </label>
                                    </div>
                                </div>

                                <div className="flex justify-end pt-2">
                                    <Button
                                        size="lg"
                                        onClick={handleCheckout}
                                        disabled={!name || !deadline || checkout.isPending}
                                    >
                                        {checkout.isPending ? (
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin"/>
                                        ) : (
                                            <ShoppingCart className="h-4 w-4 mr-2"/>
                                        )}
                                        {t('createInvoice')} ({formatXLM(String(total))} XLM)
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>
        </div>
    );
}
