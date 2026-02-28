import {useCallback, useEffect, useRef, useState} from 'react';
import {MapPin} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import type {LocationData} from '@/types';

// Common countries — sorted alphabetically, with popular travel destinations first
const COUNTRIES: Array<{ code: string; name: string }> = [
    {code: 'AR', name: 'Argentina'},
    {code: 'AU', name: 'Australia'},
    {code: 'AT', name: 'Austria'},
    {code: 'BE', name: 'Belgium'},
    {code: 'BO', name: 'Bolivia'},
    {code: 'BR', name: 'Brazil'},
    {code: 'CA', name: 'Canada'},
    {code: 'CL', name: 'Chile'},
    {code: 'CN', name: 'China'},
    {code: 'CO', name: 'Colombia'},
    {code: 'CR', name: 'Costa Rica'},
    {code: 'HR', name: 'Croatia'},
    {code: 'CU', name: 'Cuba'},
    {code: 'CZ', name: 'Czech Republic'},
    {code: 'DK', name: 'Denmark'},
    {code: 'DO', name: 'Dominican Republic'},
    {code: 'EC', name: 'Ecuador'},
    {code: 'EG', name: 'Egypt'},
    {code: 'SV', name: 'El Salvador'},
    {code: 'FI', name: 'Finland'},
    {code: 'FR', name: 'France'},
    {code: 'DE', name: 'Germany'},
    {code: 'GR', name: 'Greece'},
    {code: 'GT', name: 'Guatemala'},
    {code: 'HN', name: 'Honduras'},
    {code: 'HU', name: 'Hungary'},
    {code: 'IS', name: 'Iceland'},
    {code: 'IN', name: 'India'},
    {code: 'ID', name: 'Indonesia'},
    {code: 'IE', name: 'Ireland'},
    {code: 'IL', name: 'Israel'},
    {code: 'IT', name: 'Italy'},
    {code: 'JP', name: 'Japan'},
    {code: 'KE', name: 'Kenya'},
    {code: 'MX', name: 'Mexico'},
    {code: 'MA', name: 'Morocco'},
    {code: 'NL', name: 'Netherlands'},
    {code: 'NZ', name: 'New Zealand'},
    {code: 'NI', name: 'Nicaragua'},
    {code: 'NO', name: 'Norway'},
    {code: 'PA', name: 'Panama'},
    {code: 'PY', name: 'Paraguay'},
    {code: 'PE', name: 'Peru'},
    {code: 'PH', name: 'Philippines'},
    {code: 'PL', name: 'Poland'},
    {code: 'PT', name: 'Portugal'},
    {code: 'PR', name: 'Puerto Rico'},
    {code: 'RO', name: 'Romania'},
    {code: 'ZA', name: 'South Africa'},
    {code: 'KR', name: 'South Korea'},
    {code: 'ES', name: 'Spain'},
    {code: 'SE', name: 'Sweden'},
    {code: 'CH', name: 'Switzerland'},
    {code: 'TH', name: 'Thailand'},
    {code: 'TR', name: 'Turkey'},
    {code: 'GB', name: 'United Kingdom'},
    {code: 'US', name: 'United States'},
    {code: 'UY', name: 'Uruguay'},
    {code: 'VE', name: 'Venezuela'},
    {code: 'VN', name: 'Vietnam'},
];

interface PhotonFeature {
    properties: {
        name: string;
        country: string;
        countrycode: string;
        state?: string;
        city?: string;
        osm_value?: string;
    };
    geometry: {
        coordinates: [number, number]; // [lng, lat]
    };
}

interface LocationEditorProps {
    value: LocationData | null;
    onChange: (location: LocationData | null) => void;
    label?: string;
    inheritedLocation?: LocationData | null;
}

export function LocationEditor({value, onChange, label, inheritedLocation}: LocationEditorProps) {
    const {t} = useTranslation();
    const isNull = value === null;

    const [cityQuery, setCityQuery] = useState('');
    const [suggestions, setSuggestions] = useState<PhotonFeature[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const defaultLocation = (): LocationData => ({
        country: '',
        country_code: '',
        city: '',
        address: '',
        lat: null,
        lng: null,
    });

    const loc = value ?? defaultLocation();

    const handleEnable = () => {
        onChange(defaultLocation());
    };

    const handleClear = () => {
        onChange(null);
    };

    const handleFieldChange = (field: keyof LocationData, val: string) => {
        const updated = {...loc, [field]: val};
        // If country changes, reset city and coords
        if (field === 'country_code') {
            const country = COUNTRIES.find(c => c.code === val);
            updated.country = country?.name ?? '';
            updated.country_code = val;
            updated.city = '';
            updated.lat = null;
            updated.lng = null;
            setCityQuery('');
            setSuggestions([]);
        }
        onChange(updated);
    };

    const searchCities = useCallback(async (query: string, countryCode: string) => {
        if (query.length < 2) {
            setSuggestions([]);
            return;
        }
        setIsSearching(true);
        try {
            const url = new URL('https://photon.komoot.io/api/');
            url.searchParams.set('q', query);
            url.searchParams.set('limit', '10');
            url.searchParams.set('lang', 'en');
            // Include cities, towns, and villages
            url.searchParams.append('osm_tag', 'place:city');
            url.searchParams.append('osm_tag', 'place:town');
            url.searchParams.append('osm_tag', 'place:village');
            const res = await fetch(url.toString());
            const data = await res.json() as { features: PhotonFeature[] };
            // Filter by country if selected
            const filtered = countryCode
                ? data.features.filter(f =>
                    f.properties.countrycode?.toUpperCase() === countryCode.toUpperCase()
                ).slice(0, 7)
                : data.features.slice(0, 7);
            setSuggestions(filtered);
            if (filtered.length > 0) setShowSuggestions(true);
        } catch {
            setSuggestions([]);
        } finally {
            setIsSearching(false);
        }
    }, []);

    const handleCityInputChange = (val: string) => {
        setCityQuery(val);
        // Clear lat/lng since user is typing a new city
        onChange({...loc, city: val, lat: null, lng: null});

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            searchCities(val, loc.country_code);
        }, 300);
    };

    const handleSelectCity = (feature: PhotonFeature) => {
        const props = feature.properties;
        const [lng, lat] = feature.geometry.coordinates;
        const cityName = props.name || props.city || '';

        // Auto-fill country if not set
        const countryCode = props.countrycode?.toUpperCase() ?? loc.country_code;
        const countryName = COUNTRIES.find(c => c.code === countryCode)?.name ?? props.country ?? loc.country;

        onChange({
            ...loc,
            city: cityName,
            country: countryName,
            country_code: countryCode,
            lat,
            lng,
        });
        setCityQuery(cityName);
        setSuggestions([]);
        setShowSuggestions(false);
    };

    // Sync cityQuery when value changes externally (e.g. edit page loading)
    useEffect(() => {
        if (value?.city && cityQuery !== value.city) {
            setCityQuery(value.city);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value?.city]);

    // Close suggestions on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const inputClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

    return (
        <div className="space-y-3">
            {label && (
                <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground"/>
                    <span className="text-sm font-medium">{label}</span>
                </div>
            )}

            {/* Inheritance hint for services */}
            {isNull && inheritedLocation && (
                <div className="flex items-center justify-between rounded-md border border-dashed border-input p-3">
                    <p className="text-xs text-muted-foreground">
                        {t('location.inheritingFromBusiness')}
                        {inheritedLocation.city && (
                            <span className="ml-1 font-medium">
                                ({[inheritedLocation.city, inheritedLocation.country].filter(Boolean).join(', ')})
                            </span>
                        )}
                    </p>
                    <button
                        type="button"
                        onClick={handleEnable}
                        className="text-xs text-primary hover:underline"
                    >
                        {t('location.override')}
                    </button>
                </div>
            )}

            {isNull && !inheritedLocation && (
                <button
                    type="button"
                    onClick={handleEnable}
                    className="w-full rounded-md border border-dashed border-input p-3 text-xs text-muted-foreground hover:border-ring hover:bg-muted/50 transition-colors"
                >
                    {t('location.addLocation')}
                </button>
            )}

            {!isNull && (
                <>
                    <div className="grid gap-3 sm:grid-cols-2">
                        {/* Country select */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">
                                {t('location.country')}
                            </label>
                            <select
                                value={loc.country_code}
                                onChange={(e) => handleFieldChange('country_code', e.target.value)}
                                className={inputClass}
                            >
                                <option value="">{t('location.countryPlaceholder')}</option>
                                {COUNTRIES.map(c => (
                                    <option key={c.code} value={c.code}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* City autocomplete */}
                        <div className="space-y-1 relative" ref={containerRef}>
                            <label className="text-xs font-medium text-muted-foreground">
                                {t('location.city')}
                            </label>
                            <input
                                type="text"
                                value={cityQuery}
                                onChange={(e) => handleCityInputChange(e.target.value)}
                                onFocus={() => {
                                    if (suggestions.length > 0) setShowSuggestions(true);
                                }}
                                placeholder={t('location.cityPlaceholder')}
                                className={inputClass}
                                autoComplete="off"
                            />
                            {isSearching && (
                                <div className="absolute right-3 top-8 text-xs text-muted-foreground">...</div>
                            )}
                            {showSuggestions && suggestions.length > 0 && (
                                <ul className="absolute z-50 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-md border bg-popover shadow-md">
                                    {suggestions.map((feature, i) => {
                                        const p = feature.properties;
                                        const label = [p.name, p.state, p.country].filter(Boolean).join(', ');
                                        return (
                                            <li
                                                key={`${p.name}-${i}`}
                                                onClick={() => handleSelectCity(feature)}
                                                className="cursor-pointer px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                                            >
                                                {label}
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    </div>

                    {/* Address */}
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">
                            {t('location.address')}
                        </label>
                        <input
                            type="text"
                            value={loc.address}
                            onChange={(e) => handleFieldChange('address', e.target.value)}
                            placeholder={t('location.addressPlaceholder')}
                            className={inputClass}
                        />
                    </div>

                    {/* Validated indicator */}
                    {loc.lat !== null && loc.lng !== null && (
                        <p className="text-xs text-green-600 flex items-center gap-1">
                            <MapPin className="h-3 w-3"/>
                            {t('location.validated')}
                        </p>
                    )}

                    {/* Clear button (for services to revert to inherited) */}
                    {inheritedLocation && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="text-xs text-muted-foreground hover:text-foreground"
                        >
                            {t('location.clearOverride')}
                        </button>
                    )}
                </>
            )}
        </div>
    );
}
