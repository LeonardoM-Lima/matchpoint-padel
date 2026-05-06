import type { MatchmakingSuggestion } from '../../specs/001-matchpoint-mvp/contracts/types';
import { Avatar } from './Avatar';
import { Icon } from './Icon';

function getLevelClass(level: MatchmakingSuggestion['level']) {
  if (level === 'Iniciante') return 'bg-sky-400/15 text-sky-200 ring-sky-300/30';
  if (level === 'Amador') return 'bg-emerald-400/15 text-emerald-200 ring-emerald-300/30';
  return 'bg-amber-400/15 text-amber-200 ring-amber-300/30';
}

interface PlayerCardProps {
  player: MatchmakingSuggestion;
}

export function PlayerCard({ player }: PlayerCardProps) {
  const totalGames = player.wins + player.losses;
  const winRate = totalGames > 0 ? Math.round((player.wins / totalGames) * 100) : 0;

  return (
    <article className="relative overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 transition hover:border-emerald-300/40 animate-slide-up">
      <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-emerald-400/10 blur-3xl" />

      <div className="relative grid grid-cols-[auto_1fr_auto] items-center gap-3">
        <Avatar name={player.name} size={52} />

        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold text-slate-50">{player.name}</h2>
          <p className="flex items-center gap-1.5 text-xs text-slate-400">
            <Icon name="trophy" size={12} className="text-amber-300" />#{player.position} no ranking
          </p>
        </div>

        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getLevelClass(player.level)}`}
        >
          <Icon name="star" size={12} strokeWidth={2.5} />
          {player.level}
        </span>
      </div>

      <div className="relative mt-4 grid grid-cols-3 gap-2 text-sm">
        <div className="rounded-xl bg-slate-950/70 p-3 ring-1 ring-slate-800/60">
          <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-500">
            <Icon name="lightning" size={10} className="text-emerald-300" />
            Pontos
          </span>
          <strong className="text-base text-slate-50">{player.points}</strong>
        </div>
        <div className="rounded-xl bg-slate-950/70 p-3 ring-1 ring-slate-800/60">
          <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-500">
            <Icon name="target" size={10} className="text-sky-300" />
            Δ
          </span>
          <strong className="text-base text-emerald-300">{player.pointDiff}</strong>
        </div>
        <div className="rounded-xl bg-slate-950/70 p-3 ring-1 ring-slate-800/60">
          <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-500">
            <Icon name="chartBar" size={10} className="text-fuchsia-300" />
            {totalGames > 0 ? 'Aprov.' : 'Jogos'}
          </span>
          <strong className="text-base text-slate-50">
            {totalGames > 0 ? `${winRate}%` : totalGames}
          </strong>
        </div>
      </div>
    </article>
  );
}
