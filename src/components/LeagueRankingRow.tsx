import type { LeagueRankingEntry } from '../../specs/002-perfil-e-ligas/contracts/types';
import { Avatar } from './Avatar';
import { CategoryBadge } from './CategoryBadge';
import { Icon } from './Icon';

interface LeagueRankingRowProps {
  entry: LeagueRankingEntry;
}

export function LeagueRankingRow({ entry }: LeagueRankingRowProps) {
  const podium = {
    1: {
      badge: 'bg-gradient-gold text-amber-950',
      card: 'border-transparent bg-slate-900/70 shadow-gold',
      ring: 'ring-2 ring-amber-300/70',
      icon: 'crown' as const,
      iconColor: 'text-amber-300',
    },
    2: {
      badge: 'bg-gradient-silver text-slate-900',
      card: 'border-transparent bg-slate-900/70 shadow-soft',
      ring: 'ring-2 ring-slate-200/60',
      icon: 'trophy' as const,
      iconColor: 'text-slate-200',
    },
    3: {
      badge: 'bg-gradient-bronze text-orange-50',
      card: 'border-transparent bg-slate-900/70 shadow-soft',
      ring: 'ring-2 ring-orange-400/60',
      icon: 'medal' as const,
      iconColor: 'text-orange-300',
    },
  }[entry.position];

  return (
    <article
      className={[
        'relative grid grid-cols-[auto_1fr_auto] items-center gap-3 overflow-hidden rounded-2xl border p-3',
        entry.isCurrentUser
          ? 'border-emerald-300/70 bg-emerald-500/15 shadow-glow'
          : podium
            ? podium.card
            : 'border-slate-800/80 bg-slate-900/60',
      ].join(' ')}
    >
      {podium ? (
        <div
          className={[
            'pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-30 blur-2xl',
            entry.position === 1
              ? 'bg-amber-300'
              : entry.position === 2
                ? 'bg-slate-200'
                : 'bg-orange-400',
          ].join(' ')}
        />
      ) : null}

      <span
        className={[
          'relative flex h-9 w-9 items-center justify-center rounded-xl text-sm font-extrabold',
          podium
            ? podium.badge
            : entry.isCurrentUser
              ? 'bg-emerald-300 text-slate-950'
              : 'bg-slate-800 text-slate-200',
        ].join(' ')}
      >
        {podium ? <Icon name={podium.icon} size={18} strokeWidth={2.3} /> : `#${entry.position}`}
      </span>

      <div className="relative flex min-w-0 items-center gap-2.5">
        <Avatar
          name={entry.name}
          avatarUrl={entry.avatarUrl}
          size={38}
          ring={entry.isCurrentUser}
          className={podium ? podium.ring : ''}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-bold text-slate-50">{entry.name}</h3>
            <CategoryBadge category={entry.category} />
            {podium && !entry.isCurrentUser ? (
              <Icon name={podium.icon} size={13} className={podium.iconColor} strokeWidth={2.4} />
            ) : null}
          </div>
          <p className="text-[11px] text-slate-400">
            {entry.wins}V / {entry.losses}D · {entry.level}
          </p>
        </div>
      </div>

      <div className="relative text-right">
        <strong className="block text-lg font-extrabold text-slate-50">{entry.points}</strong>
        <span className="text-[10px] uppercase tracking-wide text-slate-500">pts</span>
      </div>
    </article>
  );
}
