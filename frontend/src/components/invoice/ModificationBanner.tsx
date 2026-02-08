import {AlertTriangle} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {Button} from '@/components/ui/button';

interface ModificationBannerProps {
    version: number;
    contributedAtVersion: number;
    onConfirm: () => void;
    onOptOut: () => void;
    isLoading?: boolean;
}

export function ModificationBanner({
                                       version,
                                       contributedAtVersion,
                                       onConfirm,
                                       onOptOut,
                                       isLoading,
                                   }: ModificationBannerProps) {
    const {t} = useTranslation('invoices');

    if (version <= contributedAtVersion) return null;

    return (
        <div className="rounded-lg border border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 p-4 space-y-3">
            <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5"/>
                <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                        {t('modification.title')}
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                        {t('modification.description', {from: contributedAtVersion, to: version})}
                    </p>
                </div>
            </div>
            <div className="flex gap-2 ml-8">
                <Button size="sm" onClick={onConfirm} disabled={isLoading}>
                    {t('modification.confirmChanges')}
                </Button>
                <Button size="sm" variant="outline" onClick={onOptOut} disabled={isLoading}>
                    {t('modification.optOut')}
                </Button>
            </div>
        </div>
    );
}
