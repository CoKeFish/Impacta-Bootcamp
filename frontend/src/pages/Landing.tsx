import {Link} from 'react-router-dom';
import {ArrowRight, FileText, Shield, Users, Wallet} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {Button} from '@/components/ui/button';

export function Landing() {
    const {t} = useTranslation('landing');

    const features = [
        {
            icon: Users,
            title: t('features.coordination.title'),
            description: t('features.coordination.description'),
        },
        {
            icon: Shield,
            title: t('features.escrow.title'),
            description: t('features.escrow.description'),
        },
        {
            icon: Wallet,
            title: t('features.penalties.title'),
            description: t('features.penalties.description'),
        },
    ];

    return (
        <div className="flex flex-col">
            {/* Hero */}
            <section className="container flex flex-col items-center gap-8 pb-16 pt-20 text-center md:pt-32">
                <div className="mx-auto max-w-3xl space-y-4">
                    <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
                        {t('hero.title')}{' '}
                        <span className="text-primary">{t('hero.titleHighlight')}</span>
                    </h1>
                    <p className="mx-auto max-w-xl text-lg text-muted-foreground">
                        {t('hero.subtitle')}
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                    <Button asChild size="lg">
                        <Link to="/invoices">
                            <FileText className="mr-2 h-4 w-4"/>
                            {t('hero.ctaInvoices')}
                        </Link>
                    </Button>
                    <Button asChild variant="outline" size="lg">
                        <Link to="/services">
                            {t('hero.ctaServices')} <ArrowRight className="ml-2 h-4 w-4"/>
                        </Link>
                    </Button>
                </div>
            </section>

            {/* Features */}
            <section className="border-t bg-muted/50">
                <div className="container py-20">
                    <div className="grid gap-8 md:grid-cols-3">
                        {features.map((f) => (
                            <div key={f.title} className="flex flex-col items-center gap-4 text-center">
                                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                                    <f.icon className="h-7 w-7 text-primary"/>
                                </div>
                                <h3 className="text-lg font-semibold">{f.title}</h3>
                                <p className="text-sm text-muted-foreground max-w-xs">{f.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
}
