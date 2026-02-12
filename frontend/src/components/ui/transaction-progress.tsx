import {AnimatePresence, motion} from 'framer-motion';
import {Check, Loader2, Radio} from 'lucide-react';

type StepStatus = 'pending' | 'active' | 'done';

interface Step {
    label: string;
    status: StepStatus;
}

interface TransactionProgressProps {
    steps: Step[];
}

function StepIcon({status}: { status: StepStatus }) {
    return (
        <AnimatePresence mode="wait">
            {status === 'pending' && (
                <motion.div
                    key="pending"
                    initial={{scale: 0}}
                    animate={{scale: 1}}
                    exit={{scale: 0}}
                    className="h-8 w-8 rounded-full border-2 border-border bg-muted flex items-center justify-center"
                >
                    <Radio className="h-3 w-3 text-muted-foreground"/>
                </motion.div>
            )}
            {status === 'active' && (
                <motion.div
                    key="active"
                    initial={{scale: 0}}
                    animate={{scale: 1}}
                    exit={{scale: 0}}
                    className="h-8 w-8 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center"
                >
                    <Loader2 className="h-4 w-4 text-primary animate-spin"/>
                </motion.div>
            )}
            {status === 'done' && (
                <motion.div
                    key="done"
                    initial={{scale: 0}}
                    animate={{scale: 1}}
                    exit={{scale: 0}}
                    className="h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center"
                >
                    <Check className="h-4 w-4 text-white"/>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

export function TransactionProgress({steps}: TransactionProgressProps) {
    return (
        <div className="flex flex-col gap-3 py-2">
            {steps.map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                    <StepIcon status={step.status}/>
                    <span className={`text-sm transition-colors ${
                        step.status === 'active' ? 'text-foreground font-medium' :
                            step.status === 'done' ? 'text-emerald-600 dark:text-emerald-400' :
                                'text-muted-foreground'
                    }`}>
                        {step.label}
                    </span>
                </div>
            ))}
        </div>
    );
}

export function useTransactionSteps(actionLoading: string | null, actionName: string, labels: [string, string, string]) {
    if (actionLoading !== actionName) return null;

    const steps: Step[] = [
        {label: labels[0], status: 'done'},
        {label: labels[1], status: 'active'},
        {label: labels[2], status: 'pending'},
    ];

    return steps;
}
