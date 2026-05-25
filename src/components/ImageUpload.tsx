import { useMemo, useState } from 'react';
import { ErrorBanner } from './ErrorBanner';
import { Icon } from './Icon';
import { profileService } from '../services/profile.service';

interface ImageUploadProps {
  label: string;
  currentUrl?: string | null;
  disabled?: boolean;
  onFileSelected?: (file: File | null) => void;
  upload?: (file: File) => Promise<string>;
  onUploaded?: (path: string) => void;
}

export function ImageUpload({
  label,
  currentUrl,
  disabled = false,
  onFileSelected,
  upload,
  onUploaded,
}: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const previewUrl = useMemo(() => preview ?? currentUrl ?? null, [currentUrl, preview]);

  async function handleChange(file: File | undefined) {
    setError(null);
    if (!file) {
      setPreview(null);
      onFileSelected?.(null);
      return;
    }

    try {
      profileService.validateImage(file);
      setPreview(URL.createObjectURL(file));
      onFileSelected?.(file);

      if (upload) {
        setUploading(true);
        const path = await upload(file);
        onUploaded?.(path);
      }
    } catch (nextError) {
      setPreview(null);
      onFileSelected?.(null);
      setError(nextError instanceof Error ? nextError.message : 'Foto deve ser JPG, PNG ou WebP com ate 2MB');
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="grid gap-2.5 rounded-xl border border-slate-800/80 bg-slate-900/40 p-3">
      <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-emerald-300">
        <Icon name="user" size={14} />
        {label}
      </span>

      <div className="flex items-center gap-3">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-slate-500">
          {previewUrl ? (
            <img className="h-full w-full object-cover" src={previewUrl} alt="" />
          ) : (
            <Icon name="user" size={28} />
          )}
        </div>

        <label className="inline-flex min-h-[44px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-emerald-300/40 bg-emerald-400/10 px-4 text-sm font-bold text-emerald-200 transition hover:bg-emerald-400/20">
          <Icon name="plus" size={16} />
          {uploading ? 'Enviando...' : 'Escolher foto'}
          <input
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={disabled || uploading}
            onChange={(event) => {
              void handleChange(event.target.files?.[0]);
            }}
          />
        </label>
      </div>

      {error ? <ErrorBanner message={error} /> : null}
    </section>
  );
}
