import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
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
    <main className="min-h-screen bg-slate-950 px-4 pb-28 pt-6 text-slate-50">
      <section className="mx-auto grid max-w-md gap-6">
        <header className="grid gap-3">
          <Link className="text-sm font-semibold text-emerald-300" to="/">
            Voltar
          </Link>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-300">
              MatchPoint Padel
            </p>
            <h1 className="text-3xl font-bold">Ranking</h1>
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
            title="So existe um jogador no ranking"
            description="Cadastre mais jogadores para comparar pontos e ver a disputa por posicoes."
          />
        ) : null}

        {!loading && !error ? (
          <div className="grid gap-3">
            {ranking.map((entry) => (
              <RankingRow
                key={entry.id}
                entry={entry}
                isCurrentUser={entry.id === currentEntry?.id}
              />
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
