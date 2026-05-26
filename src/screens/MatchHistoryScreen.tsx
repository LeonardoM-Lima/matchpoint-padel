import { Link } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import { Icon } from '../components/Icon';
import { MatchHistoryCard } from '../components/MatchHistoryCard';
import { ScreenSkeleton } from '../components/ScreenSkeleton';
import { useMatchHistory } from '../hooks/useMatchHistory';

export function MatchHistoryScreen() {
  const { loading, error, matches } = useMatchHistory();

  return (
    <main className="min-h-screen px-4 pb-32 pt-6 text-slate-50">
      <section className="mx-auto grid max-w-md gap-5 animate-fade-in">
        <header className="grid gap-3">
          <Link
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-300 hover:text-emerald-200"
            to="/profile"
          >
            <Icon name="arrowLeft" size={16} />
            Voltar
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-soft">
              <Icon name="chartBar" size={22} strokeWidth={2.2} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">
                EvoPadel
              </p>
              <h1 className="font-display text-3xl font-extrabold text-slate-50">Histórico</h1>
            </div>
          </div>
        </header>

        {loading ? <ScreenSkeleton rows={4} /> : null}

        {error ? <ErrorBanner message={error} /> : null}

        {!loading && !error && matches.length === 0 ? (
          <EmptyState
            icon="racket"
            title="Nenhuma partida registrada"
            description="Quando você registrar partidas, elas aparecerão aqui em ordem cronológica."
          />
        ) : null}

        {!loading && matches.length > 0 ? (
          <section className="grid gap-3">
            {matches.map((match) => (
              <MatchHistoryCard key={match.matchId} match={match} />
            ))}
          </section>
        ) : null}
      </section>
    </main>
  );
}
