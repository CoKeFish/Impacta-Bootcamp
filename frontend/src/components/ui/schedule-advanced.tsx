import {Plus, X} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import type {DayOfWeek, TimeSlot} from '@/types';

const DAYS: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

interface ScheduleAdvancedProps {
    slots: Record<DayOfWeek, TimeSlot[]>;
    onChange: (slots: Record<DayOfWeek, TimeSlot[]>) => void;
    disabled?: boolean;
}

export function ScheduleAdvanced({slots, onChange, disabled}: ScheduleAdvancedProps) {
    const {t} = useTranslation();

    const updateDay = (day: DayOfWeek, daySlots: TimeSlot[]) => {
        onChange({...slots, [day]: daySlots});
    };

    const toggleClosed = (day: DayOfWeek) => {
        const current = slots[day] || [];
        if (current.length === 0) {
            updateDay(day, [{from: '09:00', to: '18:00'}]);
        } else {
            updateDay(day, []);
        }
    };

    const addRange = (day: DayOfWeek) => {
        const current = slots[day] || [];
        const lastTo = current.length > 0 ? (current[current.length - 1]?.to ?? '09:00') : '09:00';
        const h = parseInt(lastTo.split(':')[0] ?? '9', 10);
        const newFrom = lastTo;
        const newTo = `${String(Math.min(h + 2, 23)).padStart(2, '0')}:00`;
        updateDay(day, [...current, {from: newFrom, to: newTo}]);
    };

    const removeRange = (day: DayOfWeek, index: number) => {
        const current = [...(slots[day] || [])];
        current.splice(index, 1);
        updateDay(day, current);
    };

    const updateRange = (day: DayOfWeek, index: number, field: 'from' | 'to', value: string) => {
        const current = [...(slots[day] || [])];
        const existing = current[index];
        if (existing) {
            current[index] = {...existing, [field]: value};
        }
        updateDay(day, current);
    };

    const inputClass = 'h-9 rounded-md border border-input bg-background px-2 text-sm tabular-nums';

    return (
        <div className="space-y-3">
            {DAYS.map((day) => {
                const daySlots = slots[day] || [];
                const isClosed = daySlots.length === 0;
                return (
                    <div key={day} className="space-y-1.5">
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-medium w-24">{t(`schedule.days.${day}`)}</span>
                            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={isClosed}
                                    onChange={() => toggleClosed(day)}
                                    disabled={disabled}
                                    className="rounded"
                                />
                                {t('schedule.closed')}
                            </label>
                        </div>
                        {!isClosed && (
                            <div className="space-y-1.5 pl-1">
                                {daySlots.map((slot, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <input
                                            type="time"
                                            step="1800"
                                            value={slot.from}
                                            onChange={(e) => updateRange(day, i, 'from', e.target.value)}
                                            disabled={disabled}
                                            className={inputClass}
                                        />
                                        <span className="text-xs text-muted-foreground">–</span>
                                        <input
                                            type="time"
                                            step="1800"
                                            value={slot.to}
                                            onChange={(e) => updateRange(day, i, 'to', e.target.value)}
                                            disabled={disabled}
                                            className={inputClass}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeRange(day, i)}
                                            disabled={disabled}
                                            className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                        >
                                            <X className="h-3.5 w-3.5"/>
                                        </button>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => addRange(day)}
                                    disabled={disabled}
                                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                                >
                                    <Plus className="h-3 w-3"/>
                                    {t('schedule.addRange')}
                                </button>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
