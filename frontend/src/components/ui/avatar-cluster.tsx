const palette = [
    'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
    'bg-violet-500', 'bg-cyan-500', 'bg-orange-500', 'bg-teal-500',
];

function hashColor(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return palette[Math.abs(hash) % palette.length]!;
}

function getInitial(name: string): string {
    return name.length > 0 ? name.charAt(0).toUpperCase() : '?';
}

interface Participant {
    username?: string | null;
    wallet_address: string;
}

interface AvatarClusterProps {
    participants: Participant[];
    max?: number;
    size?: 'sm' | 'md';
}

export function AvatarCluster({participants, max = 4, size = 'sm'}: AvatarClusterProps) {
    const visible = participants.slice(0, max);
    const overflow = participants.length - max;
    const dim = size === 'sm' ? 'h-7 w-7 text-xs' : 'h-9 w-9 text-sm';
    const overlap = size === 'sm' ? '-ml-2' : '-ml-2.5';

    return (
        <div className="flex items-center">
            {visible.map((p, i) => {
                const label = p.username ?? p.wallet_address;
                const bg = hashColor(p.wallet_address);
                return (
                    <div
                        key={p.wallet_address}
                        className={`${dim} ${bg} ${i > 0 ? overlap : ''} inline-flex items-center justify-center rounded-full text-white font-medium ring-2 ring-background`}
                        title={label}
                    >
                        {getInitial(label)}
                    </div>
                );
            })}
            {overflow > 0 && (
                <div
                    className={`${dim} ${overlap} inline-flex items-center justify-center rounded-full bg-muted text-muted-foreground font-medium ring-2 ring-background`}
                >
                    +{overflow}
                </div>
            )}
        </div>
    );
}
