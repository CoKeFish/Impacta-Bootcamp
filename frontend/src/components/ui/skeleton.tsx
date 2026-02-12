import {cn} from '@/lib/utils';

function Skeleton({className, ...props}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn(
                'rounded-md bg-muted bg-[length:200%_100%] bg-gradient-to-r from-muted via-muted-foreground/5 to-muted animate-shimmer',
                className,
            )}
            {...props}
        />
    );
}

function CardSkeleton() {
    return (
        <div className="rounded-lg border bg-card p-6 space-y-4">
            <div className="flex items-start justify-between">
                <Skeleton className="h-5 w-32"/>
                <Skeleton className="h-5 w-16 rounded-full"/>
            </div>
            <Skeleton className="h-4 w-full"/>
            <Skeleton className="h-2 w-full rounded-full"/>
            <div className="flex justify-between">
                <Skeleton className="h-3 w-24"/>
                <Skeleton className="h-3 w-20"/>
            </div>
        </div>
    );
}

function GridSkeleton({count = 6}: { count?: number }) {
    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({length: count}).map((_, i) => (
                <CardSkeleton key={i}/>
            ))}
        </div>
    );
}

function StatCardSkeleton() {
    return (
        <div className="rounded-lg border bg-card p-6 space-y-3">
            <Skeleton className="h-4 w-24"/>
            <Skeleton className="h-8 w-20"/>
            <Skeleton className="h-3 w-32"/>
        </div>
    );
}

function DetailSkeleton() {
    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Skeleton className="h-8 w-64"/>
                <Skeleton className="h-4 w-48"/>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
                <StatCardSkeleton/>
                <StatCardSkeleton/>
                <StatCardSkeleton/>
            </div>
            <div className="rounded-lg border bg-card p-6 space-y-4">
                <Skeleton className="h-5 w-32"/>
                <Skeleton className="h-10 w-full"/>
                <Skeleton className="h-10 w-full"/>
            </div>
        </div>
    );
}

function ListSkeleton({rows = 4}: { rows?: number }) {
    return (
        <div className="space-y-3">
            {Array.from({length: rows}).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-28"/>
                        <Skeleton className="h-5 w-14 rounded-full"/>
                    </div>
                    <Skeleton className="h-4 w-20"/>
                </div>
            ))}
        </div>
    );
}

export {Skeleton, CardSkeleton, GridSkeleton, StatCardSkeleton, DetailSkeleton, ListSkeleton};
