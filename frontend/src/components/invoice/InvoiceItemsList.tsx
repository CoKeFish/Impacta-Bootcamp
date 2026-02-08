import {useTranslation} from 'react-i18next';
import {formatXLM, truncateAddress} from '@/lib/utils';
import type {InvoiceItem} from '@/types';

interface InvoiceItemsListProps {
    items: InvoiceItem[];
}

export function InvoiceItemsList({items}: InvoiceItemsListProps) {
    const {t} = useTranslation();

    if (!items.length) {
        return <p className="text-sm text-muted-foreground">{t('noItems')}</p>;
    }

    return (
        <div className="space-y-2">
            {items.map((item) => (
                <div
                    key={item.id}
                    className="flex items-center justify-between py-2 px-3 rounded-lg border"
                >
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{item.description}</p>
                        {item.business_name && (
                            <p className="text-xs text-muted-foreground">{item.business_name}</p>
                        )}
                        {item.recipient_wallet && (
                            <p className="text-xs text-muted-foreground font-mono">
                                {truncateAddress(item.recipient_wallet)}
                            </p>
                        )}
                    </div>
                    <span className="text-sm font-mono font-medium ml-4 whitespace-nowrap">
                        {formatXLM(item.amount)} XLM
                    </span>
                </div>
            ))}
        </div>
    );
}
