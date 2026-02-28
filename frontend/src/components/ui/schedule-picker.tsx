import {useState} from 'react';
import {CalendarClock, Grid3X3, List} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import type {DayOfWeek, Schedule, TimeSlot} from '@/types';
import {ScheduleGrid} from './schedule-grid';
import {ScheduleAdvanced} from './schedule-advanced';

const DAYS: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const COMMON_TIMEZONES = [
    'America/Argentina/Buenos_Aires',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Sao_Paulo',
    'America/Mexico_City',
    'America/Bogota',
    'America/Santiago',
    'Europe/London',
    'Europe/Madrid',
    'Europe/Paris',
    'Europe/Berlin',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Asia/Dubai',
    'Australia/Sydney',
    'Pacific/Auckland',
];

function emptySlots(): Record<DayOfWeek, TimeSlot[]> {
    const s = {} as Record<DayOfWeek, TimeSlot[]>;
    for (const d of DAYS) s[d] = [];
    return s;
}

function defaultSchedule(): Schedule {
    return {
        not_applicable: false,
        timezone: 'America/Argentina/Buenos_Aires',
        slots: emptySlots(),
    };
}

interface SchedulePickerProps {
    value: Schedule | null;
    onChange: (schedule: Schedule | null) => void;
    label?: string;
    inheritedSchedule?: Schedule | null;
}

export function SchedulePicker({value, onChange, label, inheritedSchedule}: SchedulePickerProps) {
    const {t} = useTranslation();
    const [mode, setMode] = useState<'visual' | 'advanced'>('visual');

    const schedule = value ?? defaultSchedule();
    const isNull = value === null;

    const handleToggleNA = () => {
        if (schedule.not_applicable) {
            onChange({...schedule, not_applicable: false});
        } else {
            onChange({...schedule, not_applicable: true});
        }
    };

    const handleClear = () => {
        onChange(null);
    };

    const handleEnable = () => {
        onChange(defaultSchedule());
    };

    const handleTimezoneChange = (tz: string) => {
        onChange({...schedule, timezone: tz});
    };

    const handleSlotsChange = (slots: Record<DayOfWeek, TimeSlot[]>) => {
        onChange({...schedule, slots});
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                {label && (
                    <div className="flex items-center gap-2">
                        <CalendarClock className="h-4 w-4 text-muted-foreground"/>
                        <span className="text-sm font-medium">{label}</span>
                    </div>
                )}
            </div>

            {/* Inheritance hint for services */}
            {isNull && inheritedSchedule && (
                <div className="flex items-center justify-between rounded-md border border-dashed border-input p-3">
                    <p className="text-xs text-muted-foreground">{t('schedule.inheritingFromBusiness')}</p>
                    <button
                        type="button"
                        onClick={handleEnable}
                        className="text-xs text-primary hover:underline"
                    >
                        {t('schedule.override')}
                    </button>
                </div>
            )}

            {isNull && !inheritedSchedule && (
                <button
                    type="button"
                    onClick={handleEnable}
                    className="w-full rounded-md border border-dashed border-input p-3 text-xs text-muted-foreground hover:border-ring hover:bg-muted/50 transition-colors"
                >
                    {t('schedule.addSchedule')}
                </button>
            )}

            {!isNull && (
                <>
                    {/* Not applicable toggle */}
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={schedule.not_applicable}
                            onChange={handleToggleNA}
                            className="rounded"
                        />
                        <span className="text-sm text-muted-foreground">{t('schedule.notApplicable')}</span>
                    </label>

                    {!schedule.not_applicable && (
                        <>
                            {/* Timezone */}
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">{t('schedule.timezone')}</label>
                                <select
                                    value={schedule.timezone}
                                    onChange={(e) => handleTimezoneChange(e.target.value)}
                                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                                >
                                    {COMMON_TIMEZONES.map((tz) => (
                                        <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Mode toggle */}
                            <div className="flex gap-1 p-1 bg-muted rounded-md w-fit">
                                <button
                                    type="button"
                                    onClick={() => setMode('visual')}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                                        mode === 'visual'
                                            ? 'bg-background text-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    <Grid3X3 className="h-3.5 w-3.5"/>
                                    {t('schedule.visualMode')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMode('advanced')}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                                        mode === 'advanced'
                                            ? 'bg-background text-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    <List className="h-3.5 w-3.5"/>
                                    {t('schedule.advancedMode')}
                                </button>
                            </div>

                            {/* Grid or Advanced */}
                            {mode === 'visual' ? (
                                <ScheduleGrid slots={schedule.slots} onChange={handleSlotsChange}/>
                            ) : (
                                <ScheduleAdvanced slots={schedule.slots} onChange={handleSlotsChange}/>
                            )}
                        </>
                    )}

                    {/* Clear button (for services to revert to inherited) */}
                    {inheritedSchedule && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="text-xs text-muted-foreground hover:text-foreground"
                        >
                            {t('schedule.clearOverride')}
                        </button>
                    )}
                </>
            )}
        </div>
    );
}
