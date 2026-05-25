import { useEffect, useMemo, useState } from 'react';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { LikeButton } from './LikeButton';
import {
  deleteVideo,
  getVideoPublicUrl,
  VIDEO_CATEGORY_LABEL,
  type FeedItem,
} from '../services/feed.service';

interface VideoCardProps {
  item: FeedItem;
  currentProfileId?: string;
  onDeleted: (videoId: string) => void;
  onError: (message: string) => void;
}

const relativeFormatter = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

function relativeTime(value: string) {
  const diffMs = new Date(value).getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60000);
  const absMinutes = Math.abs(diffMinutes);

  if (absMinutes < 60) return relativeFormatter.format(diffMinutes, 'minute');

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return relativeFormatter.format(diffHours, 'hour');

  const diffDays = Math.round(diffHours / 24);
  return relativeFormatter.format(diffDays, 'day');
}

export function VideoCard({ item, currentProfileId, onDeleted, onError }: VideoCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const videoUrl = useMemo(() => getVideoPublicUrl(item.storagePath), [item.storagePath]);
  const canDelete = currentProfileId === item.authorId;

  useEffect(() => {
    let mounted = true;

    async function createPoster() {
      try {
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.muted = true;
        video.playsInline = true;
        video.preload = 'auto';
        video.src = videoUrl;

        await new Promise<void>((resolve, reject) => {
          const handleLoadedData = () => resolve();
          const handleError = () => reject(new Error('poster-load-failed'));

          video.addEventListener('loadeddata', handleLoadedData, { once: true });
          video.addEventListener('error', handleError, { once: true });
        });

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;

        const context = canvas.getContext('2d');
        if (!context) return;

        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        if (mounted) {
          setPosterUrl(canvas.toDataURL('image/jpeg', 0.82));
        }
      } catch {
        if (mounted) {
          setPosterUrl(null);
        }
      }
    }

    void createPoster();

    return () => {
      mounted = false;
    };
  }, [videoUrl]);

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteVideo(item.id, item.storagePath);
      onDeleted(item.id);
    } catch (nextError) {
      onError(nextError instanceof Error ? nextError.message : 'Não foi possível excluir o vídeo. Tente novamente.');
    } finally {
      setDeleting(false);
      setConfirming(false);
      setMenuOpen(false);
    }
  }

  return (
    <article className="overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-900/60 shadow-soft">
      <video
        className="aspect-video w-full bg-slate-950 object-cover"
        controls
        playsInline
        preload="auto"
        crossOrigin="anonymous"
        poster={posterUrl ?? undefined}
        src={videoUrl}
      />

      <div className="grid gap-4 p-4">
        <header className="flex items-start gap-3">
          <Avatar name={item.authorName} avatarUrl={item.authorAvatar} size={42} ring />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-sm font-bold text-slate-50">{item.authorName}</h2>
              <span className="rounded-full bg-emerald-300/15 px-2 py-0.5 text-[10px] font-bold text-emerald-200 ring-1 ring-emerald-300/20">
                {VIDEO_CATEGORY_LABEL[item.category]}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">{relativeTime(item.createdAt)}</p>
          </div>

          {canDelete ? (
            <div className="relative">
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 text-slate-400 transition hover:text-slate-200"
                aria-label="Abrir menu do vídeo"
                onClick={() => setMenuOpen((open) => !open)}
              >
                <Icon name="moreVertical" size={18} />
              </button>

              {menuOpen ? (
                <div className="absolute right-0 top-11 z-10 w-36 rounded-xl border border-slate-800 bg-slate-950 p-1 shadow-soft">
                  <button
                    type="button"
                    className="w-full rounded-lg px-3 py-2 text-left text-sm font-bold text-rose-200 transition hover:bg-rose-400/10"
                    onClick={() => setConfirming(true)}
                  >
                    Excluir
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </header>

        <div>
          <h3 className="text-base font-extrabold leading-snug text-slate-50">{item.title}</h3>
        </div>

        <div className="flex items-center justify-between gap-3">
          <LikeButton
            videoId={item.id}
            profileId={currentProfileId}
            initialLiked={item.viewerLiked}
            initialCount={item.likeCount}
            onError={onError}
          />
        </div>
      </div>

      {confirming ? (
        <div className="border-t border-slate-800 bg-slate-950/90 p-4">
          <p className="text-sm text-slate-200">Excluir este vídeo do feed?</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-700 px-4 font-bold text-slate-200"
              disabled={deleting}
              onClick={() => setConfirming(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-rose-400 px-4 font-bold text-rose-950 disabled:opacity-60"
              disabled={deleting}
              onClick={() => {
                void handleDelete();
              }}
            >
              {deleting ? 'Excluindo...' : 'Excluir'}
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
