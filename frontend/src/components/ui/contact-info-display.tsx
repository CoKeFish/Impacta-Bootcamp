import {Globe, Mail, MessageCircle, Phone} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import type {ContactInfo} from '@/types';

interface ContactInfoDisplayProps {
    contactInfo: ContactInfo | null;
    compact?: boolean;
}

export function ContactInfoDisplay({contactInfo, compact}: ContactInfoDisplayProps) {
    const {t} = useTranslation();

    if (!contactInfo) return null;

    if (contactInfo.not_applicable) {
        if (compact) return null;
        return (
            <p className="text-sm text-muted-foreground">{t('contact.contactNA')}</p>
        );
    }

    const hasAny = contactInfo.email || contactInfo.phone || contactInfo.whatsapp || contactInfo.website;
    if (!hasAny) return null;

    if (compact) {
        return (
            <div className="flex items-center gap-2">
                {contactInfo.phone && (
                    <a href={`tel:${contactInfo.phone}`}
                       className="text-muted-foreground hover:text-foreground transition-colors"
                       title={contactInfo.phone}>
                        <Phone className="h-3.5 w-3.5"/>
                    </a>
                )}
                {contactInfo.whatsapp && (
                    <a href={`https://wa.me/${contactInfo.whatsapp.replace(/\D/g, '')}`}
                       target="_blank" rel="noopener noreferrer"
                       className="text-muted-foreground hover:text-foreground transition-colors"
                       title={contactInfo.whatsapp}>
                        <MessageCircle className="h-3.5 w-3.5"/>
                    </a>
                )}
                {contactInfo.email && (
                    <a href={`mailto:${contactInfo.email}`}
                       className="text-muted-foreground hover:text-foreground transition-colors"
                       title={contactInfo.email}>
                        <Mail className="h-3.5 w-3.5"/>
                    </a>
                )}
                {contactInfo.website && (
                    <a href={contactInfo.website} target="_blank" rel="noopener noreferrer"
                       className="text-muted-foreground hover:text-foreground transition-colors"
                       title={contactInfo.website}>
                        <Globe className="h-3.5 w-3.5"/>
                    </a>
                )}
            </div>
        );
    }

    // Full display
    return (
        <div className="space-y-1.5">
            {contactInfo.email && (
                <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground"/>
                    <a href={`mailto:${contactInfo.email}`} className="hover:underline">{contactInfo.email}</a>
                </div>
            )}
            {contactInfo.phone && (
                <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground"/>
                    <a href={`tel:${contactInfo.phone}`} className="hover:underline">{contactInfo.phone}</a>
                </div>
            )}
            {contactInfo.whatsapp && (
                <div className="flex items-center gap-2 text-sm">
                    <MessageCircle className="h-3.5 w-3.5 text-muted-foreground"/>
                    <a href={`https://wa.me/${contactInfo.whatsapp.replace(/\D/g, '')}`}
                       target="_blank" rel="noopener noreferrer" className="hover:underline">
                        {contactInfo.whatsapp}
                    </a>
                </div>
            )}
            {contactInfo.website && (
                <div className="flex items-center gap-2 text-sm">
                    <Globe className="h-3.5 w-3.5 text-muted-foreground"/>
                    <a href={contactInfo.website} target="_blank" rel="noopener noreferrer"
                       className="hover:underline">
                        {contactInfo.website}
                    </a>
                </div>
            )}
        </div>
    );
}
