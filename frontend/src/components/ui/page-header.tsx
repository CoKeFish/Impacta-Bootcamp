import {motion} from 'framer-motion';
import type {ReactNode} from 'react';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    action?: ReactNode;
    children?: ReactNode;
}

export function PageHeader({title, subtitle, action, children}: PageHeaderProps) {
    return (
        <section
            className="border-b bg-muted/20"
            style={{background: 'radial-gradient(ellipse 80% 80% at 50% 0%, hsl(var(--primary) / 0.06), transparent)'}}
        >
            <div className="container py-8 space-y-4">
                <motion.div
                    className="flex items-center justify-between gap-4"
                    initial={{opacity: 0, y: -10}}
                    animate={{opacity: 1, y: 0}}
                    transition={{duration: 0.4}}
                >
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
                        {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
                    </div>
                    {action}
                </motion.div>
                {children}
            </div>
        </section>
    );
}
