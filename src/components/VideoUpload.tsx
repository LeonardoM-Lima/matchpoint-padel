import { useEffect, useMemo, useState } from 'react';
import { Icon } from './Icon';
import { validateVideo } from '../services/feed.service';

interface VideoUploadProps {
  file: File | null;
  disabled?: boolean;
  error?: string | null;
  onSelected: (file: File | null) => void;
  onError: (message: string | null) => void;
}

export function VideoUpload({
  file,
  disabled = false,
  error,
  onSelected,
  onError,
}: VideoUploadProps) {
  const [checking, setChecking] = useState(false);
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function handleFile(nextFile: File | null) {
    onError(null);

    if (!nextFile) {
      onSelected(null);
      return;
    }

    setChecking(true);
    try {
      await validateVideo(nextFile);
      onSelected(nextFile);
    } catch (nextError) {
      onSelected(null);
      onError(nextError instanceof Error ? nextError.message : 'Não foi possível ler o vídeo.');
    } finally {
      setChecking(false);
    }
  }

  return (
    <section className="grid gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4">
      <label className="grid cursor-pointer gap-3">
        <span className="text-xs font-bold uppercase tracking-wide text-emerald-300">
          Vídeo da jogada
        </span>

        <span className="flex min-h-[112px] items-center justify-center rounded-2xl border border-dashed border-emerald-300/30 bg-slate-950/80 px-4 text-center transition hover:border-emerald-300/60">
          <span className="grid justify-items-center gap-2">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-300/15 text-emerald-300 ring-1 ring-emerald-300/20">
              <Icon name="upload" size={24} />
            </span>
            <span className="text-sm font-bold text-slate-50">
              {file ? file.name : checking ? 'Validando vídeo...' : 'Selecionar vídeo'}
            </span>
            <span className="text-xs text-slate-400">MP4, MOV ou WebM, até 30MB e 30s</span>
          </span>
        </span>

        <input
          className="sr-only"
          type="file"
          accept="video/mp4,video/quicktime,video/webm"
          disabled={disabled || checking}
          onChange={(event) => {
            void handleFile(event.target.files?.[0] ?? null);
          }}
        />
      </label>

      {previewUrl ? (
        <video
          className="aspect-video w-full rounded-2xl bg-slate-950 object-cover ring-1 ring-slate-800"
          controls
          preload="metadata"
          src={previewUrl}
        />
      ) : null}

      {error ? <p className="text-sm font-semibold text-rose-300">{error}</p> : null}
    </section>
  );
}
