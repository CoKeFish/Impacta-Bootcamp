import {Link} from 'react-router-dom';
import {ArrowRight, FileText, Shield, Users, Wallet} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {motion} from 'framer-motion';
import {Button} from '@/components/ui/button';
import {fadeInUp, staggerContainer} from '@/lib/motion';

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
            <section className="relative overflow-hidden"
                     style={{background: 'radial-gradient(ellipse 80% 60% at 50% 30%, hsl(var(--primary) / 0.08), transparent)'}}>
                <div className="container relative flex flex-col items-center gap-8 pb-16 pt-20 text-center md:pt-32">
                    {/* Badge */}
                    <motion.div
                        initial={{opacity: 0, y: -10}}
                        animate={{opacity: 1, y: 0}}
                        transition={{duration: 0.5}}
                    >
                        <span
                            className="inline-flex items-center gap-2 rounded-full bg-primary-bright/10 border border-primary-bright/30 px-4 py-1.5 text-sm font-medium text-foreground">
                            <span className="h-2 w-2 rounded-full bg-primary-bright animate-pulse"/>
                            Powered by Stellar
                        </span>
                    </motion.div>

                    <motion.div
                        className="mx-auto max-w-3xl space-y-4"
                        initial={{opacity: 0, y: 20}}
                        animate={{opacity: 1, y: 0}}
                        transition={{duration: 0.6, delay: 0.1}}
                    >
                        <h1 className="font-serif text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl text-balance">
                            {t('hero.title')}{' '}
                            <span
                                className="bg-gradient-to-r from-primary-bright via-accent to-secondary bg-clip-text text-transparent">
                                {t('hero.titleHighlight')}
                            </span>
                        </h1>
                        <p className="mx-auto max-w-xl text-lg text-muted-foreground">
                            {t('hero.subtitle')}
                        </p>
                    </motion.div>

                    <motion.div
                        className="flex flex-col sm:flex-row gap-4"
                        initial={{opacity: 0, y: 20}}
                        animate={{opacity: 1, y: 0}}
                        transition={{duration: 0.6, delay: 0.25}}
                    >
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
                    </motion.div>
                </div>
            </section>

            {/* Features */}
            <section className="border-t bg-muted/30">
                <motion.div
                    className="container py-20"
                    variants={staggerContainer}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{once: true, margin: '-100px'}}
                >
                    <div className="grid gap-8 md:grid-cols-3">
                        {features.map((f) => (
                            <motion.div
                                key={f.title}
                                variants={fadeInUp}
                                className="flex flex-col items-center gap-4 text-center"
                            >
                                <div
                                    className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-bright/10 ring-2 ring-primary/90">
                                    <f.icon className="h-7 w-7 text-primary"
                                            style={{filter: 'drop-shadow(0 0 0.6px hsl(0 0% 0% / 0.4))'}}/>
                                </div>
                                <h3 className="text-lg font-semibold">{f.title}</h3>
                                <p className="text-sm text-muted-foreground max-w-xs">{f.description}</p>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>
            </section>
        </div>
    );
}
