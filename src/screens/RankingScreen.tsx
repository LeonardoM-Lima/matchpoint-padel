import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { RankingRow } from '../components/RankingRow';
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
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-50">
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

        {loading ? <p className="text-slate-300">Carregando ranking...</p> : null}

        {error ? (
          <section className="grid gap-3 rounded-lg border border-red-400/40 bg-red-950/60 p-4">
            <p className="text-sm text-red-100">{error}</p>
            <button
              className="min-h-[44px] rounded-lg bg-slate-50 px-4 py-3 font-semibold text-slate-950"
              type="button"
              onClick={() => {
                void refresh();
              }}
            >
              Tentar novamente
            </button>
          </section>
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
