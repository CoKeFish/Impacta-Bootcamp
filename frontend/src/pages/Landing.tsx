import {Link} from 'react-router-dom';
import {ArrowRight, Shield, Users, Wallet} from 'lucide-react';
import {Button} from '@/components/ui/button';

const features = [
    {
        icon: Users,
        title: 'Group coordination',
        description: 'Organize trips with friends, set budgets, and track contributions in real time.',
    },
    {
        icon: Shield,
        title: 'Escrow on-chain',
        description: 'Funds are held in a Soroban smart contract. No one can misuse the budget.',
    },
    {
        icon: Wallet,
        title: 'Fair penalties',
        description: 'If someone drops out, the penalty is automatically redistributed to the group.',
    },
];

export function Landing() {
    return (
        <div className="flex flex-col">
            {/* Hero */}
            <section className="container flex flex-col items-center gap-8 pb-16 pt-20 text-center md:pt-32">
                <div className="mx-auto max-w-3xl space-y-4">
                    <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
                        Travel together,{' '}
                        <span className="text-primary">fund together</span>
                    </h1>
                    <p className="mx-auto max-w-xl text-lg text-muted-foreground">
                        CoTravel makes group travel budgets transparent and trustless.
                        Collect contributions, enforce fair rules, and release funds &mdash;
                        all secured by Stellar smart contracts.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                    <Button asChild size="lg">
                        <Link to="/trips">
                            Browse trips <ArrowRight className="ml-2 h-4 w-4"/>
                        </Link>
                    </Button>
                    <Button asChild variant="outline" size="lg">
                        <Link to="/trips/new">Create a trip</Link>
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
