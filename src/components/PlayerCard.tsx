import type { MatchmakingSuggestion } from '../../specs/001-matchpoint-mvp/contracts/types';

function getLevelClass(level: MatchmakingSuggestion['level']) {
  if (level === 'Iniciante') return 'bg-sky-400/15 text-sky-200 ring-sky-300/30';
  if (level === 'Amador') return 'bg-emerald-400/15 text-emerald-200 ring-emerald-300/30';
  return 'bg-amber-400/15 text-amber-200 ring-amber-300/30';
}

interface PlayerCardProps {
  player: MatchmakingSuggestion;
}

export function PlayerCard({ player }: PlayerCardProps) {
  return (
    <article className="grid gap-4 rounded-lg border border-slate-800 bg-slate-900/70 p-4">
      <div className="grid grid-cols-[1fr_auto] items-start gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold text-slate-50">{player.name}</h2>
          <p className="text-sm text-slate-400">#{player.position} no ranking</p>
        </div>

        <span className={`rounded-full px-2.5 py-1 text-sm font-semibold ring-1 ${getLevelClass(player.level)}`}>
          {player.level}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-sm">
        <div className="rounded-lg bg-slate-950/70 p-3">
          <span className="block text-slate-400">Pontos</span>
          <strong className="text-slate-50">{player.points}</strong>
        </div>
        <div className="rounded-lg bg-slate-950/70 p-3">
          <span className="block text-slate-400">Delta</span>
          <strong className="text-emerald-300">{player.pointDiff}</strong>
        </div>
        <div className="rounded-lg bg-slate-950/70 p-3">
          <span className="block text-slate-400">Jogos</span>
          <strong className="text-slate-50">{player.wins + player.losses}</strong>
        </div>
      </div>
    </article>
  );
}
