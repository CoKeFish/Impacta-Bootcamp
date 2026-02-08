import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Loader2, Plus, Search} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {getServices} from '@/services/api';
import {formatXLM} from '@/lib/utils';
import type {Service} from '@/types';

interface ServicePickerProps {
    onSelect: (service: Service) => void;
}

export function ServicePicker({onSelect}: ServicePickerProps) {
    const [search, setSearch] = useState('');

    const {data: services, isLoading} = useQuery({
        queryKey: ['services', search],
        queryFn: () => getServices(search || undefined),
    });

    return (
        <div className="space-y-3">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                <input
                    type="text"
                    placeholder="Search services..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
            </div>

            {isLoading && (
                <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground"/>
                </div>
            )}

            {services && services.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No services found</p>
            )}

            {services && services.length > 0 && (
                <div className="max-h-64 overflow-y-auto space-y-1">
                    {services.map((service) => (
                        <div
                            key={service.id}
                            className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                        >
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">{service.name}</p>
                                <p className="text-xs text-muted-foreground">{service.business_name}</p>
                            </div>
                            <div className="flex items-center gap-3 ml-3">
                                <span className="text-sm font-mono">{formatXLM(service.price)} XLM</span>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => onSelect(service)}
                                >
                                    <Plus className="h-4 w-4"/>
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
