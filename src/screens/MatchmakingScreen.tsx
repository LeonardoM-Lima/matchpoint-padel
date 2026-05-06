import { Link } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import { PlayerCard } from '../components/PlayerCard';
import { ScreenSkeleton } from '../components/ScreenSkeleton';
import { useMatchmaking } from '../hooks/useMatchmaking';
import { useProfile } from '../hooks/useProfile';

export function MatchmakingScreen() {
  const { profile } = useProfile();
  const { suggestions, loading, error, refresh } = useMatchmaking();

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
            <h1 className="text-3xl font-bold">Matchmaking</h1>
            {profile ? (
              <p className="mt-2 text-slate-300">
                Sugestoes baseadas nos seus {profile.points} pontos.
              </p>
            ) : null}
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

        {!loading && !error && suggestions.length === 0 ? (
          <EmptyState
            title="Nenhum jogador encontrado"
            description="Quando houver outros jogadores cadastrados, eles aparecem aqui por proximidade de pontos."
          />
        ) : null}

        {!loading && !error && suggestions.length > 0 ? (
          <div className="grid gap-3">
            {suggestions.map((suggestion) => (
              <PlayerCard key={suggestion.id} player={suggestion} />
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
