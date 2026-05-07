import type { MatchHistoryEntry } from '../services/match.service';
import { Icon } from './Icon';

interface MatchHistoryCardProps {
  match: MatchHistoryEntry;
}

function formatDate(iso: string) {
  const date = new Date(iso);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDelta(delta: number) {
  return delta > 0 ? `+${delta}` : String(delta);
}

export function MatchHistoryCard({ match }: MatchHistoryCardProps) {
  const isWin = match.result === 'W';
  const userScore = match.userTeam === 'A' ? match.teamAScore : match.teamBScore;
  const opponentScore = match.userTeam === 'A' ? match.teamBScore : match.teamAScore;

  return (
    <article className="grid gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4">
      <header className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          {formatDate(match.playedAt)}
        </span>
        <span
          className={`inline-flex h-6 min-w-[24px] items-center justify-center rounded-full px-2 text-xs font-extrabold ring-1 ${
            isWin
              ? 'bg-emerald-400/15 text-emerald-300 ring-emerald-300/30'
              : 'bg-rose-400/15 text-rose-300 ring-rose-300/30'
          }`}
          aria-label={isWin ? 'Vitória' : 'Derrota'}
        >
          {isWin ? 'V' : 'D'}
        </span>
      </header>

      <p className="text-sm leading-snug text-slate-200">
        Com <strong className="font-semibold text-slate-50">{match.partnerName}</strong> contra{' '}
        <strong className="font-semibold text-slate-50">{match.opponent1Name}</strong> e{' '}
        <strong className="font-semibold text-slate-50">{match.opponent2Name}</strong>
      </p>

      <footer className="flex items-center justify-between gap-3 border-t border-slate-800/80 pt-3">
        <div className="flex items-center gap-1.5 text-base font-extrabold text-slate-50">
          <Icon name="tennisBall" size={14} className="text-emerald-300" />
          <span>{userScore}</span>
          <span className="text-slate-500">×</span>
          <span>{opponentScore}</span>
        </div>
        <span
          className={`text-base font-extrabold ${
            match.pointsDelta >= 0 ? 'text-emerald-300' : 'text-rose-300'
          }`}
        >
          {formatDelta(match.pointsDelta)}
        </span>
      </footer>
    </article>
  );
}
