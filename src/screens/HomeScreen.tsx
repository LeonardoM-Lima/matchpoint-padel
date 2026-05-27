import { Link } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { ErrorBanner } from '../components/ErrorBanner';
import { Icon } from '../components/Icon';
import { ScreenSkeleton } from '../components/ScreenSkeleton';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../hooks/useProfile';
import { useRanking } from '../hooks/useRanking';
import type { PlayerCategory } from '../../specs/002-perfil-e-ligas/contracts/types';

function getProgressPercent(points: number, abovePoints?: number, belowPoints?: number) {
  if (!abovePoints) return 100;

  const floor = belowPoints ?? 0;
  const range = abovePoints - floor;
  if (range <= 0) return 0;

  return Math.max(0, Math.min(100, Math.round(((points - floor) / range) * 100)));
}

function levelBadge(level: string) {
  if (level === 'Iniciante') return 'bg-sky-400/15 text-sky-200 ring-sky-300/30';
  if (level === 'Amador') return 'bg-emerald-400/15 text-emerald-200 ring-emerald-300/30';
  return 'bg-amber-400/15 text-amber-200 ring-amber-300/30';
}

function categoryBadge(category?: PlayerCategory | null) {
  if (!category) return '';
  if (category === '1a') return 'bg-amber-300/15 text-amber-200 ring-amber-300/30';
  if (category === '2a') return 'bg-orange-300/15 text-orange-200 ring-orange-300/30';
  if (category === '3a') return 'bg-fuchsia-300/15 text-fuchsia-200 ring-fuchsia-300/30';
  if (category === '4a') return 'bg-sky-300/15 text-sky-200 ring-sky-300/30';
  if (category === '5a') return 'bg-cyan-300/15 text-cyan-200 ring-cyan-300/30';
  if (category === '6a') return 'bg-teal-300/15 text-teal-200 ring-teal-300/30';
  if (category === 'Open') return 'bg-emerald-300/15 text-emerald-200 ring-emerald-300/30';
  return 'bg-slate-300/15 text-slate-200 ring-slate-300/30';
}

function categoryLabel(category?: PlayerCategory | null) {
  if (!category) return null;
  if (category === 'Open') return 'Categoria Open';
  if (category === 'Iniciante') return 'Categoria Iniciante';
  return `${category} categoria`;
}

const quickLinks = [
  {
    to: '/ranking',
    title: 'Ranking',
    subtitle: 'Top jogadores',
    icon: 'trophy' as const,
    accent: 'bg-amber-300/15 text-amber-300 ring-amber-300/20',
    hover: 'hover:border-amber-300/40',
  },
  {
    to: '/feed',
    title: 'Feed de jogadas',
    subtitle: 'Vídeos curtos da comunidade',
    icon: 'video' as const,
    accent: 'bg-emerald-300/15 text-emerald-300 ring-emerald-300/20',
    hover: 'hover:border-emerald-300/40',
  },
  {
    to: '/leagues',
    title: 'Ligas privadas',
    subtitle: 'Ranking do grupo',
    icon: 'medal' as const,
    accent: 'bg-teal-300/15 text-teal-300 ring-teal-300/20',
    hover: 'hover:border-teal-300/40',
  },
  {
    to: '/matchmaking',
    title: 'Matchmaking',
    subtitle: 'Por categoria',
    icon: 'users' as const,
    accent: 'bg-sky-300/15 text-sky-300 ring-sky-300/20',
    hover: 'hover:border-sky-300/40',
  },
  {
    to: '/profile',
    title: 'Meu perfil',
    subtitle: 'Estatísticas',
    icon: 'user' as const,
    accent: 'bg-fuchsia-300/15 text-fuchsia-300 ring-fuchsia-300/20',
    hover: 'hover:border-fuchsia-300/40',
  },
];

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

  const totalMatches = profile ? profile.wins + profile.losses : 0;
  const winRate = totalMatches > 0 && profile ? Math.round((profile.wins / totalMatches) * 100) : 0;

  return (
    <main className="min-h-screen px-4 pb-32 pt-6 text-slate-50">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-md animate-fade-in flex-col gap-5">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">
              EvoPadel
            </p>
            <h1 className="font-display text-3xl font-extrabold text-slate-50">
              Olá{profile ? `, ${profile.name.split(' ')[0]}` : ''}!
            </h1>
          </div>
          <button
            type="button"
            onClick={() => {
              void signOut();
            }}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-800 bg-slate-900/60 text-slate-300 transition hover:border-rose-300/40 hover:text-rose-300"
            aria-label="Sair"
          >
            <Icon name="logout" size={20} />
          </button>
        </header>

        {loading || rankingLoading ? <ScreenSkeleton rows={2} /> : null}

        {!loading && !rankingLoading && !profile ? (
          <ErrorBanner message="Não conseguimos carregar seu perfil. Tente sair e entrar novamente." />
        ) : null}

        {!loading && !rankingLoading && profile ? (
          <>
            <section className="relative overflow-hidden rounded-3xl border border-emerald-300/20 bg-gradient-to-br from-emerald-500/15 via-slate-900/80 to-slate-950 p-5 shadow-glow">
              <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-emerald-400/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-16 -left-12 h-40 w-40 rounded-full bg-fuchsia-500/10 blur-3xl" />

              <div className="relative flex items-center gap-3">
                <Avatar name={profile.name} avatarUrl={profile.avatarUrl} size={56} ring />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-lg font-bold text-slate-50">{profile.name}</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${levelBadge(profile.level)}`}
                    >
                      {profile.level}
                    </span>
                    {profile.category ? (
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${categoryBadge(profile.category)}`}
                      >
                        {categoryLabel(profile.category)}
                      </span>
                    ) : null}
                  </div>
                </div>
                {currentEntry ? (
                  <div className="flex flex-col items-center rounded-2xl bg-slate-950/60 px-3 py-2 ring-1 ring-emerald-300/20">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                      Posição
                    </span>
                    <strong className="text-xl font-extrabold text-gradient-emerald">
                      #{currentEntry.position}
                    </strong>
                  </div>
                ) : null}
              </div>

              <div className="relative mt-5 grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-slate-950/60 p-3 ring-1 ring-emerald-300/10">
                  <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-400">
                    <Icon name="lightning" size={10} className="text-emerald-300" />
                    Pontos
                  </span>
                  <strong className="block text-2xl font-extrabold text-emerald-300">
                    {profile.points}
                  </strong>
                </div>
                <div className="rounded-2xl bg-slate-950/60 p-3 ring-1 ring-emerald-300/10">
                  <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-400">
                    <Icon name="trophy" size={10} className="text-amber-300" />
                    Vitórias
                  </span>
                  <strong className="block text-2xl font-extrabold text-slate-50">
                    {profile.wins}
                  </strong>
                </div>
                <div className="rounded-2xl bg-slate-950/60 p-3 ring-1 ring-emerald-300/10">
                  <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-400">
                    <Icon name="target" size={10} className="text-fuchsia-300" />
                    Aprov.
                  </span>
                  <strong className="block text-2xl font-extrabold text-slate-50">
                    {totalMatches > 0 ? `${winRate}%` : '-'}
                  </strong>
                </div>
              </div>

              <div className="relative mt-5 grid gap-2">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-semibold uppercase tracking-wide text-slate-400">
                    Progresso até o próximo
                  </span>
                  <span className="text-right text-slate-300">
                    {aboveEntry
                      ? `${currentEntry?.pointDiffToAbove ?? 0} pts → ${aboveEntry.name}`
                      : 'Você está no topo!'}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-800/60">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-300 via-emerald-400 to-teal-400 transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                {belowEntry ? (
                  <span className="text-[11px] text-slate-500">
                    +{currentEntry?.pointDiffToBelow ?? 0} pts à frente de {belowEntry.name}
                  </span>
                ) : null}
              </div>

              {rankingError ? (
                <div className="relative mt-3">
                  <ErrorBanner message={rankingError} />
                </div>
              ) : null}
            </section>

            <nav className="grid gap-3">
              <Link
                className="group relative inline-flex min-h-[64px] items-center justify-between overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-500 px-5 py-3 text-left font-bold text-emerald-950 shadow-glow transition hover:scale-[1.01]"
                to="/match/new"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/30">
                    <Icon name="plusCircle" size={24} strokeWidth={2.4} />
                  </span>
                  <span>
                    <span className="block text-base">Registrar partida</span>
                    <span className="block text-xs font-medium opacity-80">
                      Atualize seus pontos
                    </span>
                  </span>
                </span>
                <Icon name="arrowRight" size={20} strokeWidth={2.5} />
              </Link>

              <div className="grid grid-cols-2 gap-3">
                {quickLinks.map((link) => (
                  <Link
                    key={link.to}
                    className={`group flex min-h-[112px] flex-col gap-2 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 transition ${link.hover}`}
                    to={link.to}
                  >
                    <span
                      className={`flex h-11 w-11 items-center justify-center rounded-xl ring-1 ${link.accent}`}
                    >
                      <Icon name={link.icon} size={22} />
                    </span>
                    <span className="grid gap-1">
                      <span className="block text-sm font-bold leading-tight text-slate-50">
                        {link.title}
                      </span>
                      <span className="block text-xs leading-snug text-slate-400">
                        {link.subtitle}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </nav>
          </>
        ) : null}
      </section>
    </main>
  );
}
