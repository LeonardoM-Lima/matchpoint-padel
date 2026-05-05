import type { RankingEntry } from '../../specs/001-matchpoint-mvp/contracts/types';

const levelStyles: Record<RankingEntry['level'], string> = {
  Iniciante: 'bg-sky-400/15 text-sky-200 ring-sky-300/30',
  Amador: 'bg-emerald-400/15 text-emerald-200 ring-emerald-300/30',
  'Avançado': 'bg-amber-400/15 text-amber-200 ring-amber-300/30',
};

function formatDelta(value: number | undefined) {
  if (value === undefined) return '-';
  return `${value} pts`;
}

interface RankingRowProps {
  entry: RankingEntry;
  isCurrentUser?: boolean;
}

export function RankingRow({ entry, isCurrentUser = false }: RankingRowProps) {
  return (
    <article
      id={isCurrentUser ? 'current-ranking-row' : undefined}
      className={[
        'grid gap-3 rounded-lg border p-4',
        isCurrentUser
          ? 'border-emerald-300 bg-emerald-950/40 shadow-[0_0_0_1px_rgba(110,231,183,0.35)]'
          : 'border-slate-800 bg-slate-900/70',
      ].join(' ')}
    >
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
        <span
          className={[
            'flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold',
            isCurrentUser ? 'bg-emerald-300 text-slate-950' : 'bg-slate-800 text-slate-100',
          ].join(' ')}
        >
          {entry.position}
        </span>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate font-semibold text-slate-50">{entry.name}</h2>
            {isCurrentUser ? (
              <span className="rounded-full bg-slate-50 px-2 py-0.5 text-xs font-bold text-slate-950">
                Voce
              </span>
            ) : null}
          </div>
          <p className="text-sm text-slate-400">
            {entry.wins} vitorias - {entry.losses} derrotas
          </p>
        </div>

        <div className="text-right">
          <strong className="block text-lg text-slate-50">{entry.points}</strong>
          <span className="text-xs text-slate-400">pontos</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className={`rounded-full px-2.5 py-1 font-semibold ring-1 ${levelStyles[entry.level]}`}>
          {entry.level}
        </span>
        <span className="text-slate-300">
          Acima {formatDelta(entry.pointDiffToAbove)} - Abaixo {formatDelta(entry.pointDiffToBelow)}
        </span>
      </div>
    </article>
  );
}
