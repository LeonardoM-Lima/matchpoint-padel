import { Link } from 'react-router-dom';
import { ErrorBanner } from '../components/ErrorBanner';
import { ScreenSkeleton } from '../components/ScreenSkeleton';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../hooks/useProfile';
import { useRanking } from '../hooks/useRanking';

function getProgressPercent(points: number, abovePoints?: number, belowPoints?: number) {
  if (!abovePoints) return 100;

  const floor = belowPoints ?? 0;
  const range = abovePoints - floor;
  if (range <= 0) return 0;

  return Math.max(0, Math.min(100, Math.round(((points - floor) / range) * 100)));
}

export function HomeScreen() {
  const { signOut } = useAuth();
  const { profile, loading } = useProfile();
  const {
    currentEntry,
    aboveEntry,
    belowEntry,
    loading: rankingLoading,
    error: rankingError,
  } = useRanking();

  const progressPercent = currentEntry
    ? getProgressPercent(currentEntry.points, aboveEntry?.points, belowEntry?.points)
    : 0;

  return (
    <main className="min-h-screen bg-slate-950 px-4 pb-28 pt-6 text-slate-50">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-md flex-col gap-6">
        <header className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-300">
            MatchPoint Padel
          </p>
          <h1 className="text-3xl font-bold">Home</h1>
          {loading ? (
            <p className="text-slate-300">Carregando seu perfil...</p>
          ) : profile ? (
            <p className="text-slate-300">
              {profile.name} - {profile.points} pontos
            </p>
          ) : (
            <p className="text-slate-300">Nao conseguimos carregar seu perfil.</p>
          )}
        </header>

        {loading || rankingLoading ? <ScreenSkeleton rows={2} /> : null}

        {!loading && !rankingLoading && !profile ? (
          <ErrorBanner message="Nao conseguimos carregar seu perfil. Tente sair e entrar novamente." />
        ) : null}

        {!loading && !rankingLoading && profile ? (
          <section className="grid gap-4 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-sm text-slate-400">Pontos</span>
                <strong className="block text-2xl text-emerald-300">{profile.points}</strong>
              </div>
              <div>
                <span className="text-sm text-slate-400">Ranking</span>
                <strong className="block text-2xl text-slate-50">
                  {rankingLoading ? '...' : currentEntry ? `#${currentEntry.position}` : '-'}
                </strong>
              </div>
            </div>

            <div>
              <span className="text-sm text-slate-400">Seu nivel</span>
              <strong className="block text-xl text-emerald-300">{profile.level}</strong>
              <span className="text-sm text-slate-300">
                {profile.wins} vitorias - {profile.losses} derrotas
              </span>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-slate-200">Proxima posicao</span>
                <span className="text-right text-slate-300">
                  {aboveEntry
                    ? `${currentEntry?.pointDiffToAbove ?? 0} pts ate ${aboveEntry.name}`
                    : 'Voce esta no topo'}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-emerald-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              {belowEntry ? (
                <span className="text-xs text-slate-400">
                  {currentEntry?.pointDiffToBelow ?? 0} pts acima de {belowEntry.name}
                </span>
              ) : null}
            </div>

            {rankingError ? <ErrorBanner message={rankingError} /> : null}
          </section>
        ) : null}

        <nav className="grid gap-3">
          <Link
            className="min-h-[44px] rounded-lg bg-emerald-400 px-4 py-3 text-center font-semibold text-slate-950"
            to="/match/new"
          >
            Registrar partida
          </Link>
          <Link
            className="min-h-[44px] rounded-lg bg-emerald-300/15 px-4 py-3 text-center font-semibold text-emerald-100 ring-1 ring-emerald-300/30"
            to="/matchmaking"
          >
            Matchmaking
          </Link>
          <Link
            className="min-h-[44px] rounded-lg bg-slate-800 px-4 py-3 text-center font-semibold"
            to="/ranking"
          >
            Ranking
          </Link>
          <Link
            className="min-h-[44px] rounded-lg bg-slate-800 px-4 py-3 text-center font-semibold"
            to="/profile"
          >
            Perfil
          </Link>
        </nav>

        <button
          className="mt-auto min-h-[44px] rounded-lg border border-slate-700 px-4 py-3 font-semibold text-slate-100"
          type="button"
          onClick={() => {
            void signOut();
          }}
        >
          Sair
        </button>
      </section>
    </main>
  );
}
