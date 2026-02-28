import {Clock} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import type {DayOfWeek, Schedule} from '@/types';

const DAYS: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function getTodayDay(): DayOfWeek {
    const jsDay = new Date().getDay(); // 0=Sun
    const map: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return map[jsDay] as DayOfWeek;
}

interface ScheduleDisplayProps {
    schedule: Schedule | null;
    compact?: boolean;
}

export function ScheduleDisplay({schedule, compact}: ScheduleDisplayProps) {
    const {t} = useTranslation();

    if (!schedule) return null;

    if (schedule.not_applicable) {
        if (compact) {
            return (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3"/>
                    {t('schedule.scheduleNA')}
                </span>
            );
        }
        return (
            <p className="text-sm text-muted-foreground">{t('schedule.scheduleNA')}</p>
        );
    }

    if (compact) {
        const today = getTodayDay();
        const todaySlots = schedule.slots[today] || [];
        if (todaySlots.length === 0) {
            return (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3"/>
                    {t('schedule.closedToday')}
                </span>
            );
        }
        const ranges = todaySlots.map((s) => `${s.from}–${s.to}`).join(', ');
        return (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3"/>
                {t('schedule.openToday')}: {ranges}
            </span>
        );
    }

    // Full display: mini table
    return (
        <div className="space-y-1">
            {DAYS.map((day) => {
                const daySlots = schedule.slots[day] || [];
                return (
                    <div key={day} className="flex items-center gap-3 text-sm">
                        <span className="w-20 text-muted-foreground">{t(`schedule.daysShort.${day}`)}</span>
                        {daySlots.length === 0 ? (
                            <span className="text-muted-foreground/60">{t('schedule.closed')}</span>
                        ) : (
                            <span>{daySlots.map((s) => `${s.from}–${s.to}`).join(', ')}</span>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
