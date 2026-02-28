import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enCommon from './locales/en/common.json';
import enLanding from './locales/en/landing.json';
import enInvoices from './locales/en/invoices.json';
import enBusinesses from './locales/en/businesses.json';
import enServices from './locales/en/services.json';
import enProfile from './locales/en/profile.json';
import enAdmin from './locales/en/admin.json';
import enCart from './locales/en/cart.json';

import esCommon from './locales/es/common.json';
import esLanding from './locales/es/landing.json';
import esInvoices from './locales/es/invoices.json';
import esBusinesses from './locales/es/businesses.json';
import esServices from './locales/es/services.json';
import esProfile from './locales/es/profile.json';
import esAdmin from './locales/es/admin.json';
import esCart from './locales/es/cart.json';

export const supportedLanguages = ['en', 'es'] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

export const languageNames: Record<SupportedLanguage, string> = {
    en: 'EN',
    es: 'ES',
};

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            en: {
                common: enCommon,
                landing: enLanding,
                invoices: enInvoices,
                businesses: enBusinesses,
                services: enServices,
                profile: enProfile,
                admin: enAdmin,
                cart: enCart,
            },
            es: {
                common: esCommon,
                landing: esLanding,
                invoices: esInvoices,
                businesses: esBusinesses,
                services: esServices,
                profile: esProfile,
                admin: esAdmin,
                cart: esCart,
            },
        },
        fallbackLng: 'en',
        defaultNS: 'common',
        ns: ['common', 'landing', 'invoices', 'businesses', 'services', 'profile', 'admin', 'cart'],
        interpolation: {
            escapeValue: false,
        },
        detection: {
            order: ['localStorage', 'navigator'],
            lookupLocalStorage: 'cotravel-lang',
            caches: ['localStorage'],
        },
    });

export default i18n;
