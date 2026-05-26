import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { CategoryBadge } from '../components/CategoryBadge';
import { ErrorBanner } from '../components/ErrorBanner';
import { Icon } from '../components/Icon';
import { ScreenSkeleton } from '../components/ScreenSkeleton';
import { useProfile } from '../hooks/useProfile';
import { rankingService } from '../services/ranking.service';
import { profileService, type PublicProfile } from '../services/profile.service';
import type { RankingEntry } from '../../specs/001-matchpoint-mvp/contracts/types';

function getLevelClass(level: string) {
  if (level === 'Iniciante') return 'bg-sky-400/15 text-sky-200 ring-sky-300/30';
  if (level === 'Amador') return 'bg-emerald-400/15 text-emerald-200 ring-emerald-300/30';
  return 'bg-amber-400/15 text-amber-200 ring-amber-300/30';
}

export function PlayerProfileScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile: currentProfile } = useProfile();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [rankingEntry, setRankingEntry] = useState<RankingEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    if (currentProfile?.id === id) {
      navigate('/profile', { replace: true });
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    Promise.all([profileService.getPublicProfile(id), rankingService.getRanking()])
      .then(([nextProfile, ranking]) => {
        if (!active) return;
        setProfile(nextProfile);
        setRankingEntry(ranking.find((entry) => entry.id === id) ?? null);
      })
      .catch(() => {
        if (active) setError('Não foi possível carregar este perfil.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentProfile?.id, id, navigate]);

  const totalMatches = profile ? profile.wins + profile.losses : 0;
  const winRate = totalMatches > 0 && profile ? Math.round((profile.wins / totalMatches) * 100) : 0;

  return (
    <main className="min-h-screen px-4 pb-32 pt-6 text-slate-50">
      <section className="mx-auto grid max-w-md animate-fade-in gap-5">
        <header className="grid gap-3">
          <button
            className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-emerald-300 hover:text-emerald-200"
            type="button"
            onClick={() => navigate(-1)}
          >
            <Icon name="arrowLeft" size={16} />
            Voltar
          </button>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-300/15 text-emerald-300 ring-1 ring-emerald-300/25">
              <Icon name="user" size={22} strokeWidth={2.2} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">
                Jogador
              </p>
              <h1 className="font-display text-3xl font-extrabold text-slate-50">Perfil</h1>
            </div>
          </div>
        </header>

        {loading ? <ScreenSkeleton rows={3} /> : null}
        {error ? <ErrorBanner message={error} /> : null}

        {!loading && profile ? (
          <>
            <section className="relative overflow-hidden rounded-3xl border border-emerald-300/20 bg-gradient-to-br from-emerald-500/10 via-slate-900/80 to-slate-950 p-6 shadow-soft">
              <div className="relative flex flex-col items-center gap-3 text-center">
                <Avatar name={profile.name} avatarUrl={profile.avatarUrl} size={96} ring />
                <div>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <h2 className="text-2xl font-extrabold text-slate-50">{profile.name}</h2>
                    <CategoryBadge category={profile.category} />
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {totalMatches} {totalMatches === 1 ? 'partida registrada' : 'partidas registradas'}
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
                {rankingEntry ? (
                  <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-400">
                    <Icon name="chartBar" size={12} className="text-emerald-300" />
                    {rankingEntry.position}º no ranking
                  </span>
                ) : null}
              </div>
            </section>

            <section className="grid grid-cols-3 gap-3">
              <StatCard label="Vitórias" value={profile.wins} icon="trophy" color="text-emerald-300" />
              <StatCard label="Derrotas" value={profile.losses} icon="xCircle" color="text-rose-300" />
              <StatCard label="Aprov." value={`${winRate}%`} icon="target" color="text-slate-50" />
            </section>

            <Link
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-emerald-300/40 bg-emerald-400/10 px-4 font-semibold text-emerald-200 transition hover:bg-emerald-400/20"
              to="/ranking"
            >
              <Icon name="trophy" size={18} />
              Ver ranking global
            </Link>
          </>
        ) : null}
      </section>
    </main>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: 'trophy' | 'xCircle' | 'target';
  color: string;
}

function StatCard({ label, value, icon, color }: StatCardProps) {
  return (
    <div className="grid gap-2 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-950/70 ring-1 ring-slate-700">
        <Icon name={icon} size={16} className={color} />
      </span>
      <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <strong className={`text-2xl font-extrabold ${color}`}>{value}</strong>
    </div>
  );
}
