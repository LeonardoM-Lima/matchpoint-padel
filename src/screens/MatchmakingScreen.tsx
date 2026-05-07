import { Link } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import { Icon } from '../components/Icon';
import { MatchmakingCard } from '../components/MatchmakingCard';
import { ScreenSkeleton } from '../components/ScreenSkeleton';
import { useMatchmaking } from '../hooks/useMatchmaking';
import { useProfile } from '../hooks/useProfile';

export function MatchmakingScreen() {
  const { profile } = useProfile();
  const { suggestions, loading, error, refresh } = useMatchmaking();

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
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-500 shadow-soft">
              <Icon name="users" size={24} strokeWidth={2.2} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">
                MatchPoint Padel
              </p>
              <h1 className="font-display text-3xl font-extrabold text-slate-50">Matchmaking</h1>
            </div>
          </div>
          {profile ? (
            <p className="flex items-center gap-2 rounded-2xl border border-slate-800/80 bg-slate-900/50 px-4 py-3 text-sm text-slate-300">
              <Icon name="sparkles" size={16} className="text-emerald-300" />
              Sugestões baseadas nos seus{' '}
              <span className="font-bold text-emerald-300">{profile.points}</span> pontos.
            </p>
          ) : null}
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
            icon="users"
            title="Nenhum jogador encontrado"
            description="Quando houver outros jogadores cadastrados, eles aparecem aqui por proximidade de pontos."
          />
        ) : null}

        {!loading && !error && suggestions.length > 0 ? (
          <div className="grid gap-3">
            {suggestions.map((suggestion) => (
              <MatchmakingCard
                key={suggestion.id}
                suggestion={suggestion}
                currentUserPoints={profile?.points ?? 0}
              />
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
