import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import { Icon } from '../components/Icon';
import { ScreenSkeleton } from '../components/ScreenSkeleton';
import { VideoCard } from '../components/VideoCard';
import { useFeed } from '../hooks/useFeed';
import { useProfile } from '../hooks/useProfile';

export function FeedScreen() {
  const { profile } = useProfile();
  const {
    items,
    loading,
    loadingMore,
    hasMore,
    error,
    nextPage,
    refresh,
    removeItem,
  } = useFeed();
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const target = sentinelRef.current;
    if (!target) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        nextPage();
      }
    }, { rootMargin: '240px' });

    observer.observe(target);
    return () => observer.disconnect();
  }, [nextPage]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  return (
    <main className="min-h-screen px-4 pb-32 pt-6 text-slate-50">
      <section className="mx-auto grid max-w-md gap-5 animate-fade-in">
        <header className="grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-300 to-teal-500 text-emerald-950 shadow-glow">
                <Icon name="video" size={23} strokeWidth={2.4} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">
                  Jogadas
                </p>
                <h1 className="font-display text-3xl font-extrabold text-slate-50">Feed</h1>
              </div>
            </div>

            <Link
              className="btn-primary inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-3 text-sm"
              to="/feed/publish"
            >
              <Icon name="plus" size={18} />
              Publicar
            </Link>
          </div>
        </header>

        {toast ? (
          <p className="rounded-xl border border-rose-300/30 bg-rose-400/10 px-3 py-3 text-sm text-rose-100">
            {toast}
          </p>
        ) : null}

        {error ? <ErrorBanner message={error} actionLabel="Tentar novamente" onAction={refresh} /> : null}

        {loading ? <ScreenSkeleton rows={3} /> : null}

        {!loading && items.length === 0 && !error ? (
          <div className="grid gap-3">
            <EmptyState
              icon="video"
              title="Nenhuma jogada ainda"
              description="Seja o primeiro a publicar um ponto bonito, uma bandeja ou aquela furada classica."
            />
            <Link
              className="btn-primary inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl px-4"
              to="/feed/publish"
            >
              <Icon name="upload" size={18} />
              Publicar vídeo
            </Link>
          </div>
        ) : null}

        <div className="grid gap-4">
          {items.map((item) => (
            <VideoCard
              key={item.id}
              item={item}
              currentProfileId={profile?.id}
              onDeleted={removeItem}
              onError={setToast}
            />
          ))}
        </div>

        <div ref={sentinelRef} className="h-4" />

        {loadingMore ? <ScreenSkeleton rows={1} /> : null}

        {!loading && !hasMore && items.length > 0 ? (
          <p className="pb-4 text-center text-xs text-slate-500">Você chegou ao fim do feed.</p>
        ) : null}
      </section>
    </main>
  );
}
