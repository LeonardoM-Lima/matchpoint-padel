import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import { Icon } from '../components/Icon';
import { RankingRow } from '../components/RankingRow';
import { ScreenSkeleton } from '../components/ScreenSkeleton';
import { useRanking } from '../hooks/useRanking';

export function RankingScreen() {
  const { ranking, currentEntry, loading, error, refresh } = useRanking();

  useEffect(() => {
    if (loading || !currentEntry) return;

    window.setTimeout(() => {
      document.getElementById('current-ranking-row')?.scrollIntoView({
        block: 'center',
        behavior: 'smooth',
      });
    }, 50);
  }, [currentEntry, loading]);

  return (
    <main className="min-h-screen px-4 pb-32 pt-6 text-slate-50">
      <section className="mx-auto grid max-w-md gap-5 animate-fade-in">
        <header className="grid gap-3">
          <Link
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-300 hover:text-emerald-200"
            to="/"
          >
            <Icon name="arrowLeft" size={16} />
            Voltar
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-gold shadow-gold">
              <Icon name="trophy" size={24} className="text-amber-950" strokeWidth={2.4} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">
                PadelUP
              </p>
              <h1 className="font-display text-3xl font-extrabold text-gradient-gold">Ranking</h1>
            </div>
          </div>
        </header>

        {loading ? <ScreenSkeleton rows={4} /> : null}

        {error ? (
          <ErrorBanner
            message={error}
            actionLabel="Tentar novamente"
            onAction={() => {
              void refresh();
            }}
          />
        ) : null}

        {!loading && !error && ranking.length === 1 ? (
          <EmptyState
            icon="users"
            title="Só existe um jogador no ranking"
            description="Cadastre mais jogadores para comparar pontos e ver a disputa por posições."
          />
        ) : null}

        {!loading && !error && ranking.length > 0 ? (
          <div className="grid gap-3">
            {ranking.map((entry, index) => {
              const prevLevel = index > 0 ? ranking[index - 1]!.level : null;
              const showDivider = prevLevel !== null && prevLevel !== entry.level;

              return (
                <div key={entry.id} className="grid gap-3">
                  {showDivider ? (
                    <div className="flex items-center gap-3 px-1">
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                        {entry.level}
                      </span>
                      <div className="h-px flex-1 bg-slate-800" />
                    </div>
                  ) : null}
                  <Link to={entry.id === currentEntry?.id ? '/profile' : `/players/${entry.id}`}>
                    <RankingRow
                      entry={entry}
                      isCurrentUser={entry.id === currentEntry?.id}
                    />
                  </Link>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>
    </main>
  );
}
