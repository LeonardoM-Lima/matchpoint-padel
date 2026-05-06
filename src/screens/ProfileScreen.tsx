import { Link } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import { ScreenSkeleton } from '../components/ScreenSkeleton';
import { useProfile } from '../hooks/useProfile';

function getLevelClass(level: string) {
  if (level === 'Iniciante') return 'bg-sky-400/15 text-sky-200 ring-sky-300/30';
  if (level === 'Amador') return 'bg-emerald-400/15 text-emerald-200 ring-emerald-300/30';
  return 'bg-amber-400/15 text-amber-200 ring-amber-300/30';
}

export function ProfileScreen() {
  const { profile, loading, refresh } = useProfile();
  const totalMatches = profile ? profile.wins + profile.losses : 0;
  const winRate = totalMatches > 0 && profile ? Math.round((profile.wins / totalMatches) * 100) : 0;

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
            <h1 className="text-3xl font-bold">Perfil</h1>
          </div>
        </header>

        {loading ? <ScreenSkeleton rows={3} /> : null}

        {!loading && !profile ? (
          <ErrorBanner message="Nao conseguimos carregar seu perfil. Tente sair e entrar novamente." />
        ) : null}

        {profile ? (
          <>
            <section className="grid gap-4 rounded-lg border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-2xl font-bold text-slate-50">{profile.name}</h2>
                  <p className="mt-1 text-sm text-slate-400">{totalMatches} partidas registradas</p>
                </div>

                <span className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${getLevelClass(profile.level)}`}>
                  {profile.level}
                </span>
              </div>

              <div className="rounded-lg bg-slate-950/70 p-4">
                <span className="text-sm text-slate-400">Pontos atuais</span>
                <strong className="block text-4xl text-emerald-300">{profile.points}</strong>
              </div>
            </section>

            <section className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
                <span className="block text-sm text-slate-400">Vitorias</span>
                <strong className="text-2xl text-emerald-300">{profile.wins}</strong>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
                <span className="block text-sm text-slate-400">Derrotas</span>
                <strong className="text-2xl text-red-300">{profile.losses}</strong>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
                <span className="block text-sm text-slate-400">Aproveit.</span>
                <strong className="text-2xl text-slate-50">{winRate}%</strong>
              </div>
            </section>

            {totalMatches === 0 ? (
              <EmptyState
                title="Nenhuma partida registrada"
                description="Depois da primeira partida, suas vitorias, derrotas e aproveitamento aparecem aqui."
              />
            ) : null}

            <button
              className="min-h-[44px] rounded-lg bg-slate-800 px-4 py-3 font-semibold text-slate-100"
              type="button"
              onClick={() => {
                void refresh();
              }}
            >
              Atualizar perfil
            </button>
          </>
        ) : null}
      </section>
    </main>
  );
}
