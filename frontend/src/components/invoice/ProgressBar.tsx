import {useTranslation} from 'react-i18next';
import {formatXLM} from '@/lib/utils';

interface ProgressBarProps {
    collected: number;
    target: number;
    className?: string;
}

export function ProgressBar({collected, target, className = ''}: ProgressBarProps) {
    const {t} = useTranslation();
    const progress = target > 0 ? Math.min((collected / target) * 100, 100) : 0;

    return (
        <div className={`space-y-2 ${className}`}>
            <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('collected')}</span>
                <span className="font-medium">
                    {formatXLM(collected)} / {formatXLM(target)} XLM
                </span>
            </div>
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{width: `${progress}%`}}
                />
            </div>
        </div>
    );
}
