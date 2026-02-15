const sizes = {
    sm: {size: 48, stroke: 4, fontSize: 'text-[10px]'},
    md: {size: 64, stroke: 5, fontSize: 'text-xs'},
    lg: {size: 80, stroke: 6, fontSize: 'text-sm'},
} as const;

interface ProgressRingProps {
    collected: number;
    target: number;
    size?: keyof typeof sizes;
    showLabel?: boolean;
    className?: string;
}

export function ProgressRing({collected, target, size = 'md', showLabel = true, className = ''}: ProgressRingProps) {
    const {size: dim, stroke, fontSize} = sizes[size];
    const radius = (dim - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const progress = target > 0 ? Math.min(collected / target, 1) : 0;
    const offset = circumference * (1 - progress);
    const percent = Math.round(progress * 100);

    return (
        <div className={`inline-flex flex-col items-center gap-1 ${className}`}>
            <svg width={dim} height={dim} className="-rotate-90">
                <circle
                    cx={dim / 2}
                    cy={dim / 2}
                    r={radius}
                    fill="none"
                    stroke="hsl(var(--muted))"
                    strokeWidth={stroke}
                />
                <circle
                    cx={dim / 2}
                    cy={dim / 2}
                    r={radius}
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    className="transition-[stroke-dashoffset] duration-700 ease-out"
                />
            </svg>
            {showLabel && (
                <span className={`${fontSize} font-medium tabular-nums text-muted-foreground`}>
                    {percent}%
                </span>
            )}
        </div>
    );
}
