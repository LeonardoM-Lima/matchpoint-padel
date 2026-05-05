import { Link } from 'react-router-dom';
import { PlayerCard } from '../components/PlayerCard';
import { useMatchmaking } from '../hooks/useMatchmaking';
import { useProfile } from '../hooks/useProfile';

export function MatchmakingScreen() {
  const { profile } = useProfile();
  const { suggestions, loading, error, refresh } = useMatchmaking();

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
            <h1 className="text-3xl font-bold">Matchmaking</h1>
            {profile ? (
              <p className="mt-2 text-slate-300">
                Baseado nos seus {profile.points} pontos.
              </p>
            ) : null}
          </div>
        </header>

        {loading ? <p className="text-slate-300">Carregando jogadores proximos...</p> : null}

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

        {!loading && !error && suggestions.length === 0 ? (
          <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
            <h2 className="font-semibold text-slate-50">Nenhum jogador encontrado</h2>
            <p className="mt-1 text-sm text-slate-400">
              Quando houver outros jogadores cadastrados, eles aparecem aqui por proximidade de pontos.
            </p>
          </section>
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
