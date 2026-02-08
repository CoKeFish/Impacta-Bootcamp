import {type ClassValue, clsx} from 'clsx';
import {twMerge} from 'tailwind-merge';
import i18n from '@/i18n';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function truncateAddress(address: string, chars = 4): string {
    return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function formatXLM(amount: number | string): string {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat(i18n.language, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(num);
}

export function formatDateShort(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString(i18n.language, {day: 'numeric', month: 'short'});
}

export function formatDateFull(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString(i18n.language);
}
