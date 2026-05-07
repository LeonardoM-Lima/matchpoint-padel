import type { MatchmakingSuggestion } from '../../specs/001-matchpoint-mvp/contracts/types';
import { getMatchLabel } from '../utils/matchmaking';
import { Avatar } from './Avatar';
import { Icon } from './Icon';

interface MatchmakingCardProps {
  suggestion: MatchmakingSuggestion;
  currentUserPoints: number;
}

const colorClasses = {
  green: {
    badge: 'bg-emerald-400/15 text-emerald-300 ring-emerald-300/30',
    dot: 'bg-emerald-400',
  },
  yellow: {
    badge: 'bg-amber-400/15 text-amber-300 ring-amber-300/30',
    dot: 'bg-amber-400',
  },
  red: {
    badge: 'bg-rose-400/15 text-rose-300 ring-rose-300/30',
    dot: 'bg-rose-400',
  },
};

const levelBadge: Record<string, string> = {
  Iniciante: 'bg-sky-400/15 text-sky-200 ring-sky-300/30',
  Amador: 'bg-emerald-400/15 text-emerald-200 ring-emerald-300/30',
  Avançado: 'bg-amber-400/15 text-amber-200 ring-amber-300/30',
};

export function MatchmakingCard({ suggestion, currentUserPoints }: MatchmakingCardProps) {
  const isFavorite = currentUserPoints > suggestion.points;
  const { label, color } = getMatchLabel(suggestion.pointDiff, isFavorite);
  const colors = colorClasses[color];

  const whatsappMessage = encodeURIComponent(
    `Oi ${suggestion.name}! Te desafio para uma partida de padel pelo MatchPoint. Topa?`,
  );
  const whatsappUrl = `https://wa.me/?text=${whatsappMessage}`;

  const gamesSuffix =
    suggestion.gamesTogether === 0
      ? 'Nunca jogaram'
      : `Já jogaram ${suggestion.gamesTogether}x`;

  return (
    <article className="grid gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4">
      <div className="flex items-center gap-3">
        <Avatar name={suggestion.name} size={44} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-bold text-slate-50">{suggestion.name}</span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${levelBadge[suggestion.level] ?? ''}`}
            >
              {suggestion.level}
            </span>
          </div>
          <span className="text-[11px] text-slate-400">#{suggestion.position} no ranking</span>
        </div>

        <div className="shrink-0 text-right">
          <span className="block text-sm font-extrabold text-slate-50">{suggestion.points}</span>
          <span className="text-[11px] text-slate-400">pts</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-0.5 rounded-xl bg-slate-950/70 px-3 py-2 ring-1 ring-slate-800/60">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Diferença
          </span>
          <span className="text-sm font-extrabold text-slate-50">
            {suggestion.pointDiff} pts
          </span>
        </div>

        <div className="flex flex-col gap-0.5 rounded-xl bg-slate-950/70 px-3 py-2 ring-1 ring-slate-800/60">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Confrontos
          </span>
          <span className="text-[11px] font-semibold text-slate-300">{gamesSuffix}</span>
        </div>
      </div>

      <div
        className={`flex items-center gap-2 rounded-xl px-3 py-2 ring-1 ${colors.badge}`}
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${colors.dot}`} />
        <span className="text-xs font-bold">{label}</span>
      </div>

      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-bold text-white transition hover:bg-emerald-400 active:scale-95"
      >
        <Icon name="users" size={16} />
        Desafiar no WhatsApp
      </a>
    </article>
  );
}
