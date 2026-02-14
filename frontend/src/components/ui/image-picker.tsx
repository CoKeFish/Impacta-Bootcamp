import {useRef, useState} from 'react';
import {ImagePlus, Link as LinkIcon, Loader2, Upload, X} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {uploadImage} from '@/services/api';

interface ImagePickerProps {
    value: string | null;
    onChange: (url: string | null) => void;
    label?: string;
}

export function ImagePicker({value, onChange, label}: ImagePickerProps) {
    const {t} = useTranslation();
    const [mode, setMode] = useState<'upload' | 'url'>('upload');
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [urlInput, setUrlInput] = useState('');
    const fileRef = useRef<HTMLInputElement>(null);

    const handleFile = async (file: File) => {
        if (file.size > 5 * 1024 * 1024) {
            setError(t('image.maxSize'));
            return;
        }
        setError(null);
        setUploading(true);
        try {
            const res = await uploadImage(file);
            onChange(res.url);
        } catch (e) {
            setError(t('image.uploadError'));
        } finally {
            setUploading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
        e.target.value = '';
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith('image/')) handleFile(file);
    };

    const handleUrlSubmit = () => {
        const trimmed = urlInput.trim();
        if (trimmed) {
            onChange(trimmed);
            setUrlInput('');
        }
    };

    const inputClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

    // If there's already an image, show preview with remove button
    if (value) {
        return (
            <div className="space-y-2">
                {label && <p className="text-sm font-medium">{label}</p>}
                <div className="relative inline-block">
                    <img
                        src={value}
                        alt=""
                        className="h-24 w-24 rounded-lg object-cover border"
                    />
                    <button
                        type="button"
                        onClick={() => onChange(null)}
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/90 transition-colors"
                    >
                        <X className="h-3.5 w-3.5"/>
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {label && <p className="text-sm font-medium">{label}</p>}

            {/* Mode toggle */}
            <div className="flex gap-1 p-1 bg-muted rounded-md w-fit">
                <button
                    type="button"
                    onClick={() => setMode('upload')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                        mode === 'upload'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <Upload className="h-3.5 w-3.5"/>
                    {t('image.uploadTab')}
                </button>
                <button
                    type="button"
                    onClick={() => setMode('url')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                        mode === 'url'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <LinkIcon className="h-3.5 w-3.5"/>
                    {t('image.urlTab')}
                </button>
            </div>

            {mode === 'upload' ? (
                <div
                    onClick={() => !uploading && fileRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-input p-6 cursor-pointer hover:border-ring hover:bg-muted/50 transition-colors"
                >
                    {uploading ? (
                        <>
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/>
                            <p className="text-sm text-muted-foreground">{t('image.uploading')}</p>
                        </>
                    ) : (
                        <>
                            <ImagePlus className="h-8 w-8 text-muted-foreground"/>
                            <p className="text-sm text-muted-foreground">{t('image.dragOrClick')}</p>
                            <p className="text-xs text-muted-foreground/70">{t('image.maxSize')}</p>
                        </>
                    )}
                    <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                    />
                </div>
            ) : (
                <div className="flex gap-2">
                    <input
                        type="url"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleUrlSubmit())}
                        placeholder={t('image.urlPlaceholder')}
                        className={inputClass}
                    />
                    <button
                        type="button"
                        onClick={handleUrlSubmit}
                        disabled={!urlInput.trim()}
                        className="flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none transition-colors"
                    >
                        OK
                    </button>
                </div>
            )}

            {error && (
                <p className="text-sm text-destructive">{error}</p>
            )}
        </div>
    );
}
