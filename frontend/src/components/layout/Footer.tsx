import {useTranslation} from 'react-i18next';

export function Footer() {
    const {t} = useTranslation();

    return (
        <footer className="border-t py-6 md:py-0">
            <div className="container flex flex-col items-center justify-between gap-4 md:h-16 md:flex-row">
                <p className="text-sm text-muted-foreground">
                    {t('footer.tagline')}
                </p>
                <p className="text-xs text-muted-foreground">
                    {t('footer.testnet')}
                </p>
            </div>
        </footer>
    );
}
