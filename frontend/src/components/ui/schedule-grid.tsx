import {useCallback, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import type {DayOfWeek, TimeSlot} from '@/types';

const DAYS: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const START_HOUR = 6;
const END_HOUR = 23;
const ROWS = (END_HOUR - START_HOUR) * 2; // 34 half-hour slots

function timeToKey(day: DayOfWeek, hour: number, half: boolean): string {
    const hh = String(hour).padStart(2, '0');
    const mm = half ? '30' : '00';
    return `${day}-${hh}:${mm}`;
}

function slotsToSet(slots: Record<DayOfWeek, TimeSlot[]>): Set<string> {
    const set = new Set<string>();
    for (const day of DAYS) {
        for (const slot of slots[day] || []) {
            const fromParts = slot.from.split(':').map(Number);
            const toParts = slot.to.split(':').map(Number);
            const fh = fromParts[0] ?? 0, fm = fromParts[1] ?? 0;
            const th = toParts[0] ?? 0, tm = toParts[1] ?? 0;
            const fromMin = fh * 60 + fm;
            const toMin = th * 60 + tm;
            for (let m = fromMin; m < toMin; m += 30) {
                const h = Math.floor(m / 60);
                const half = (m % 60) === 30;
                set.add(timeToKey(day, h, half));
            }
        }
    }
    return set;
}

function setToSlots(selected: Set<string>): Record<DayOfWeek, TimeSlot[]> {
    const result = {} as Record<DayOfWeek, TimeSlot[]>;
    for (const day of DAYS) {
        const minutes: number[] = [];
        for (let r = 0; r < ROWS; r++) {
            const hour = START_HOUR + Math.floor(r / 2);
            const half = r % 2 === 1;
            if (selected.has(timeToKey(day, hour, half))) {
                minutes.push(hour * 60 + (half ? 30 : 0));
            }
        }
        minutes.sort((a, b) => a - b);
        const ranges: TimeSlot[] = [];
        let start = -1;
        let prev = -1;
        for (const m of minutes) {
            if (start === -1) {
                start = m;
                prev = m;
            } else if (m === prev + 30) {
                prev = m;
            } else {
                ranges.push({
                    from: `${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`,
                    to: `${String(Math.floor((prev + 30) / 60)).padStart(2, '0')}:${String((prev + 30) % 60).padStart(2, '0')}`,
                });
                start = m;
                prev = m;
            }
        }
        if (start !== -1) {
            ranges.push({
                from: `${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`,
                to: `${String(Math.floor((prev + 30) / 60)).padStart(2, '0')}:${String((prev + 30) % 60).padStart(2, '0')}`,
            });
        }
        result[day] = ranges;
    }
    return result;
}

interface ScheduleGridProps {
    slots: Record<DayOfWeek, TimeSlot[]>;
    onChange: (slots: Record<DayOfWeek, TimeSlot[]>) => void;
    disabled?: boolean;
}

export function ScheduleGrid({slots, onChange, disabled}: ScheduleGridProps) {
    const {t} = useTranslation();
    const selected = slotsToSet(slots);
    const [dragging, setDragging] = useState(false);
    const intentRef = useRef<'select' | 'deselect'>('select');
    const dayRef = useRef<DayOfWeek | null>(null);
    const startRowRef = useRef<number>(0);
    const pendingRef = useRef<Set<string>>(new Set());
    const [, forceRender] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const commitDrag = useCallback(() => {
        const next = new Set(selected);
        for (const key of pendingRef.current) {
            if (intentRef.current === 'select') {
                next.add(key);
            } else {
                next.delete(key);
            }
        }
        pendingRef.current = new Set();
        onChange(setToSlots(next));
    }, [selected, onChange]);

    const getCellFromPoint = useCallback((x: number, y: number): { day: DayOfWeek; row: number } | null => {
        const el = document.elementFromPoint(x, y);
        if (!el) return null;
        const dayAttr = el.getAttribute('data-day') as DayOfWeek | null;
        const rowAttr = el.getAttribute('data-row');
        if (!dayAttr || rowAttr === null) return null;
        return {day: dayAttr, row: parseInt(rowAttr, 10)};
    }, []);

    const updatePending = useCallback((day: DayOfWeek, currentRow: number) => {
        const minR = Math.min(startRowRef.current, currentRow);
        const maxR = Math.max(startRowRef.current, currentRow);
        const next = new Set<string>();
        for (let r = minR; r <= maxR; r++) {
            const hour = START_HOUR + Math.floor(r / 2);
            const half = r % 2 === 1;
            next.add(timeToKey(day, hour, half));
        }
        pendingRef.current = next;
        forceRender((n) => n + 1);
    }, []);

    const handlePointerDown = useCallback((day: DayOfWeek, row: number) => {
        if (disabled) return;
        const hour = START_HOUR + Math.floor(row / 2);
        const half = row % 2 === 1;
        const key = timeToKey(day, hour, half);
        intentRef.current = selected.has(key) ? 'deselect' : 'select';
        dayRef.current = day;
        startRowRef.current = row;
        pendingRef.current = new Set([key]);
        setDragging(true);
        forceRender((n) => n + 1);
    }, [disabled, selected]);

    const handlePointerMove = useCallback((e: React.PointerEvent | React.TouchEvent) => {
        if (!dragging || !dayRef.current) return;
        const clientX = 'touches' in e ? (e.touches[0]?.clientX ?? 0) : (e as React.PointerEvent).clientX;
        const clientY = 'touches' in e ? (e.touches[0]?.clientY ?? 0) : (e as React.PointerEvent).clientY;
        const cell = getCellFromPoint(clientX, clientY);
        if (cell && cell.day === dayRef.current) {
            updatePending(dayRef.current, cell.row);
        }
    }, [dragging, getCellFromPoint, updatePending]);

    const handlePointerUp = useCallback(() => {
        if (!dragging) return;
        commitDrag();
        setDragging(false);
        dayRef.current = null;
    }, [dragging, commitDrag]);

    const isCellActive = (key: string) => {
        if (pendingRef.current.has(key)) {
            return intentRef.current === 'select';
        }
        return selected.has(key);
    };

    const isPending = (key: string) => pendingRef.current.has(key);

    return (
        <div
            ref={containerRef}
            className="select-none overflow-x-auto"
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onTouchMove={handlePointerMove as unknown as React.TouchEventHandler}
            onTouchEnd={handlePointerUp}
        >
            <div className="inline-grid gap-px" style={{
                gridTemplateColumns: `48px repeat(${DAYS.length}, 1fr)`,
                minWidth: '420px',
            }}>
                {/* Header row */}
                <div className="h-7"/>
                {DAYS.map((day) => (
                    <div key={day}
                         className="h-7 flex items-center justify-center text-xs font-medium text-muted-foreground">
                        {t(`schedule.daysShort.${day}`)}
                    </div>
                ))}

                {/* Time rows */}
                {Array.from({length: ROWS}, (_, r) => {
                    const hour = START_HOUR + Math.floor(r / 2);
                    const half = r % 2 === 1;
                    const timeLabel = !half ? `${String(hour).padStart(2, '0')}:00` : '';
                    return (
                        <div key={r} className="contents">
                            <div
                                className="h-5 flex items-center justify-end pr-2 text-[10px] text-muted-foreground tabular-nums">
                                {timeLabel}
                            </div>
                            {DAYS.map((day) => {
                                const key = timeToKey(day, hour, half);
                                const active = isCellActive(key);
                                const pending = isPending(key);
                                return (
                                    <div
                                        key={key}
                                        data-day={day}
                                        data-row={r}
                                        onPointerDown={(e) => {
                                            e.preventDefault();
                                            handlePointerDown(day, r);
                                        }}
                                        className={`h-5 border border-border/30 transition-colors cursor-pointer ${
                                            active
                                                ? pending
                                                    ? 'bg-primary/70'
                                                    : 'bg-primary'
                                                : pending
                                                    ? 'bg-muted'
                                                    : 'bg-background hover:bg-muted/50'
                                        } ${disabled ? 'pointer-events-none opacity-50' : ''}`}
                                    />
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
