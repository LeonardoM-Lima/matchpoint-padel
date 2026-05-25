import type { RankingEntry } from '../../specs/001-matchpoint-mvp/contracts/types';
import { Avatar } from './Avatar';
import { CategoryBadge } from './CategoryBadge';
import { Icon } from './Icon';

const levelStyles: Record<RankingEntry['level'], string> = {
  Iniciante: 'bg-sky-400/15 text-sky-200 ring-sky-300/30',
  Amador: 'bg-emerald-400/15 text-emerald-200 ring-emerald-300/30',
  'Avançado': 'bg-amber-400/15 text-amber-200 ring-amber-300/30',
};

interface PodiumStyle {
  badge: string;
  ring: string;
  glow: string;
  icon: 'crown' | 'trophy' | 'medal';
  iconColor: string;
}

const podiumByPosition: Record<number, PodiumStyle> = {
  1: {
    badge: 'bg-gradient-gold text-amber-950',
    ring: 'ring-2 ring-amber-300/70',
    glow: 'shadow-gold',
    icon: 'crown',
    iconColor: 'text-amber-300',
  },
  2: {
    badge: 'bg-gradient-silver text-slate-900',
    ring: 'ring-2 ring-slate-200/60',
    glow: 'shadow-soft',
    icon: 'trophy',
    iconColor: 'text-slate-200',
  },
  3: {
    badge: 'bg-gradient-bronze text-orange-50',
    ring: 'ring-2 ring-orange-400/60',
    glow: 'shadow-soft',
    icon: 'medal',
    iconColor: 'text-orange-300',
  },
};

interface RankingRowProps {
  entry: RankingEntry;
  isCurrentUser?: boolean;
}

export function RankingRow({ entry, isCurrentUser = false }: RankingRowProps) {
  const podium = podiumByPosition[entry.position];
  const totalMatches = entry.wins + entry.losses;
  const winRate = totalMatches > 0 ? Math.round((entry.wins / totalMatches) * 100) : 0;

  return (
    <article
      id={isCurrentUser ? 'current-ranking-row' : undefined}
      className={[
        'relative grid gap-3 overflow-hidden rounded-2xl border p-4 transition animate-slide-up',
        isCurrentUser
          ? 'border-emerald-300/70 bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent shadow-glow'
          : podium
            ? `border-transparent bg-slate-900/70 ${podium.glow}`
            : 'border-slate-800/80 bg-slate-900/60 hover:border-emerald-300/30',
      ].join(' ')}
    >
      {podium ? (
        <div
          className={[
            'pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-30 blur-2xl',
            entry.position === 1
              ? 'bg-amber-300'
              : entry.position === 2
                ? 'bg-slate-200'
                : 'bg-orange-400',
          ].join(' ')}
        />
      ) : null}

      <div className="relative grid grid-cols-[auto_auto_1fr_auto] items-center gap-3">
        <span
          className={[
            'flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold',
            podium
              ? podium.badge
              : isCurrentUser
                ? 'bg-emerald-300 text-slate-950'
                : 'bg-slate-800 text-slate-200',
          ].join(' ')}
        >
          {podium ? (
            <Icon name={podium.icon} size={20} strokeWidth={2.2} />
          ) : (
            `#${entry.position}`
          )}
        </span>

        <Avatar
          name={entry.name}
          avatarUrl={entry.avatarUrl}
          size={44}
          ring={isCurrentUser}
          className={podium ? podium.ring : ''}
        />

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate font-bold text-slate-50">{entry.name}</h2>
            <CategoryBadge category={entry.category} />
            {isCurrentUser ? (
              <span className="rounded-full bg-emerald-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-950">
                Você
              </span>
            ) : null}
            {podium && !isCurrentUser ? (
              <Icon
                name={podium.icon}
                size={14}
                className={podium.iconColor}
                strokeWidth={2.4}
              />
            ) : null}
          </div>
          <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
            <span className="text-emerald-300">{entry.wins}V</span>
            <span className="text-slate-600">·</span>
            <span className="text-rose-300">{entry.losses}D</span>
            {totalMatches > 0 ? (
              <>
                <span className="text-slate-600">·</span>
                <span>{winRate}%</span>
              </>
            ) : null}
          </p>
        </div>

        <div className="text-right">
          <strong className={['block text-xl font-extrabold leading-none', podium && entry.position === 1 ? 'text-gradient-gold' : 'text-slate-50'].join(' ')}>
            {entry.points}
          </strong>
          <span className="text-[10px] uppercase tracking-wide text-slate-500">pontos</span>
        </div>
      </div>

      <div className="relative flex flex-wrap items-center justify-between gap-2 text-xs">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold ring-1 ${levelStyles[entry.level]}`}
        >
          <Icon name="star" size={12} strokeWidth={2.5} />
          {entry.level}
        </span>
        <span className="flex items-center gap-3 text-slate-400">
          {entry.pointDiffToAbove !== undefined ? (
            <span className="flex items-center gap-1">
              <Icon name="arrowUp" size={12} className="text-emerald-300" />
              {entry.pointDiffToAbove}
            </span>
          ) : null}
          {entry.pointDiffToBelow !== undefined ? (
            <span className="flex items-center gap-1">
              <Icon name="arrowDown" size={12} className="text-rose-300" />
              {entry.pointDiffToBelow}
            </span>
          ) : null}
        </span>
      </div>
    </article>
  );
}
