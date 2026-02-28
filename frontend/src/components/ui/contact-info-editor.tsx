import {Contact} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import type {ContactInfo} from '@/types';

function defaultContactInfo(): ContactInfo {
    return {
        not_applicable: false,
        email: '',
        phone: '',
        whatsapp: '',
        website: '',
    };
}

interface ContactInfoEditorProps {
    value: ContactInfo | null;
    onChange: (info: ContactInfo | null) => void;
    label?: string;
    inheritedContactInfo?: ContactInfo | null;
}

export function ContactInfoEditor({value, onChange, label, inheritedContactInfo}: ContactInfoEditorProps) {
    const {t} = useTranslation();
    const info = value ?? defaultContactInfo();
    const isNull = value === null;

    const handleChange = (field: keyof ContactInfo, val: string | boolean) => {
        onChange({...info, [field]: val});
    };

    const handleEnable = () => {
        onChange(defaultContactInfo());
    };

    const handleClear = () => {
        onChange(null);
    };

    const inputClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

    return (
        <div className="space-y-3">
            {label && (
                <div className="flex items-center gap-2">
                    <Contact className="h-4 w-4 text-muted-foreground"/>
                    <span className="text-sm font-medium">{label}</span>
                </div>
            )}

            {/* Inheritance hint for services */}
            {isNull && inheritedContactInfo && (
                <div className="flex items-center justify-between rounded-md border border-dashed border-input p-3">
                    <p className="text-xs text-muted-foreground">{t('contact.inheritingFromBusiness')}</p>
                    <button
                        type="button"
                        onClick={handleEnable}
                        className="text-xs text-primary hover:underline"
                    >
                        {t('contact.override')}
                    </button>
                </div>
            )}

            {isNull && !inheritedContactInfo && (
                <button
                    type="button"
                    onClick={handleEnable}
                    className="w-full rounded-md border border-dashed border-input p-3 text-xs text-muted-foreground hover:border-ring hover:bg-muted/50 transition-colors"
                >
                    {t('contact.addContact')}
                </button>
            )}

            {!isNull && (
                <>
                    {/* Not applicable toggle */}
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={info.not_applicable}
                            onChange={(e) => handleChange('not_applicable', e.target.checked)}
                            className="rounded"
                        />
                        <span className="text-sm text-muted-foreground">{t('contact.notApplicable')}</span>
                    </label>

                    {!info.not_applicable && (
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1">
                                <label
                                    className="text-xs font-medium text-muted-foreground">{t('contact.email')}</label>
                                <input
                                    type="email"
                                    value={info.email}
                                    onChange={(e) => handleChange('email', e.target.value)}
                                    placeholder={t('contact.emailPlaceholder')}
                                    className={inputClass}
                                />
                            </div>
                            <div className="space-y-1">
                                <label
                                    className="text-xs font-medium text-muted-foreground">{t('contact.phone')}</label>
                                <input
                                    type="tel"
                                    value={info.phone}
                                    onChange={(e) => handleChange('phone', e.target.value)}
                                    placeholder={t('contact.phonePlaceholder')}
                                    className={inputClass}
                                />
                            </div>
                            <div className="space-y-1">
                                <label
                                    className="text-xs font-medium text-muted-foreground">{t('contact.whatsapp')}</label>
                                <input
                                    type="tel"
                                    value={info.whatsapp}
                                    onChange={(e) => handleChange('whatsapp', e.target.value)}
                                    placeholder={t('contact.whatsappPlaceholder')}
                                    className={inputClass}
                                />
                            </div>
                            <div className="space-y-1">
                                <label
                                    className="text-xs font-medium text-muted-foreground">{t('contact.website')}</label>
                                <input
                                    type="url"
                                    value={info.website}
                                    onChange={(e) => handleChange('website', e.target.value)}
                                    placeholder={t('contact.websitePlaceholder')}
                                    className={inputClass}
                                />
                            </div>
                        </div>
                    )}

                    {/* Clear button (for services to revert to inherited) */}
                    {inheritedContactInfo && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="text-xs text-muted-foreground hover:text-foreground"
                        >
                            {t('contact.clearOverride')}
                        </button>
                    )}
                </>
            )}
        </div>
    );
}
