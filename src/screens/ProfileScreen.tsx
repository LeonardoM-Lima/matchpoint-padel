import { Link } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { CategoryBadge } from '../components/CategoryBadge';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import { Icon } from '../components/Icon';
import { PushToggle } from '../components/PushToggle';
import { ScreenSkeleton } from '../components/ScreenSkeleton';
import { useProfile } from '../hooks/useProfile';
import { useRanking } from '../hooks/useRanking';

function getLevelClass(level: string) {
  if (level === 'Iniciante') return 'bg-sky-400/15 text-sky-200 ring-sky-300/30';
  if (level === 'Amador') return 'bg-emerald-400/15 text-emerald-200 ring-emerald-300/30';
  return 'bg-amber-400/15 text-amber-200 ring-amber-300/30';
}

export function ProfileScreen() {
  const { profile, loading } = useProfile();
  const { currentEntry } = useRanking();
  const totalMatches = profile ? profile.wins + profile.losses : 0;
  const winRate = totalMatches > 0 && profile ? Math.round((profile.wins / totalMatches) * 100) : 0;

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
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-400 to-purple-600 shadow-soft">
              <Icon name="user" size={22} strokeWidth={2.2} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">
                MatchPoint Padel
              </p>
              <h1 className="font-display text-3xl font-extrabold text-slate-50">Meu perfil</h1>
            </div>
          </div>
        </header>

        {loading ? <ScreenSkeleton rows={3} /> : null}

        {!loading && !profile ? (
          <ErrorBanner message="Não conseguimos carregar seu perfil. Tente sair e entrar novamente." />
        ) : null}

        {profile ? (
          <>
            <section className="relative overflow-hidden rounded-3xl border border-emerald-300/20 bg-gradient-to-br from-fuchsia-500/10 via-slate-900/80 to-slate-950 p-6 shadow-soft">
              <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-fuchsia-400/15 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-emerald-400/15 blur-3xl" />

              <div className="relative flex flex-col items-center gap-3 text-center">
                <Avatar name={profile.name} avatarUrl={profile.avatarUrl} size={96} ring />
                <div>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <h2 className="text-2xl font-extrabold text-slate-50">{profile.name}</h2>
                    <CategoryBadge category={profile.category} />
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {totalMatches} {totalMatches === 1 ? 'partida' : 'partidas'} registradas
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ring-1 ${getLevelClass(profile.level)}`}
                >
                  <Icon name="star" size={14} strokeWidth={2.5} />
                  {profile.level}
                </span>
              </div>

              <div className="relative mt-6 flex flex-col items-center gap-1 rounded-2xl bg-slate-950/70 p-5 ring-1 ring-emerald-300/20">
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400">
                  <Icon name="lightning" size={12} className="text-emerald-300" />
                  Pontos atuais
                </span>
                <strong className="text-5xl font-extrabold text-gradient-emerald">
                  {profile.points}
                </strong>
                {currentEntry ? (
                  <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-400">
                    <Icon name="chartBar" size={12} className="text-emerald-300" />
                    {currentEntry.position}º no ranking
                  </span>
                ) : null}
              </div>
            </section>

            <section className="grid grid-cols-3 gap-3">
              <StatCard
                icon="trophy"
                iconColor="text-amber-300"
                bg="bg-amber-300/10 ring-amber-300/20"
                label="Vitórias"
                value={profile.wins}
                valueColor="text-emerald-300"
              />
              <StatCard
                icon="xCircle"
                iconColor="text-rose-300"
                bg="bg-rose-300/10 ring-rose-300/20"
                label="Derrotas"
                value={profile.losses}
                valueColor="text-rose-300"
              />
              <StatCard
                icon="target"
                iconColor="text-sky-300"
                bg="bg-sky-300/10 ring-sky-300/20"
                label="Aprov."
                value={`${winRate}%`}
                valueColor="text-slate-50"
              />
            </section>

            <PushToggle profileId={profile.id} />

            {totalMatches === 0 ? (
              <EmptyState
                icon="racket"
                title="Nenhuma partida registrada"
                description="Depois da primeira partida, suas vitórias, derrotas e aproveitamento aparecem aqui."
              />
            ) : null}

            <Link
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-emerald-300/40 bg-emerald-400/10 px-4 font-semibold text-emerald-200 transition hover:bg-emerald-400/20 hover:text-emerald-100"
              to="/profile/edit"
            >
              <Icon name="user" size={18} />
              Editar perfil
              <Icon name="arrowRight" size={16} />
            </Link>

            <Link
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-emerald-300/40 bg-emerald-400/10 px-4 font-semibold text-emerald-200 transition hover:bg-emerald-400/20 hover:text-emerald-100"
              to="/profile/history"
            >
              <Icon name="chartBar" size={18} />
              Ver histórico de partidas
              <Icon name="arrowRight" size={16} />
            </Link>
          </>
        ) : null}
      </section>
    </main>
  );
}

interface StatCardProps {
  icon: 'trophy' | 'xCircle' | 'target';
  iconColor: string;
  bg: string;
  label: string;
  value: string | number;
  valueColor: string;
}

function StatCard({ icon, iconColor, bg, label, value, valueColor }: StatCardProps) {
  return (
    <div className="grid gap-2 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-3">
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-lg ring-1 ${bg} ${iconColor}`}
      >
        <Icon name={icon} size={16} />
      </span>
      <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <strong className={`text-2xl font-extrabold ${valueColor}`}>{value}</strong>
    </div>
  );
}
