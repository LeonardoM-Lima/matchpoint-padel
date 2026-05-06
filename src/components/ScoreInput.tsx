import { Icon } from './Icon';

interface ScoreInputProps {
  teamAScore: string;
  teamBScore: string;
  disabled?: boolean;
  onTeamAScoreChange: (value: string) => void;
  onTeamBScoreChange: (value: string) => void;
}

export function ScoreInput({
  teamAScore,
  teamBScore,
  disabled = false,
  onTeamAScoreChange,
  onTeamBScoreChange,
}: ScoreInputProps) {
  return (
    <fieldset className="grid gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4">
      <legend className="flex items-center gap-2 px-2 text-xs font-bold uppercase tracking-wide text-emerald-300">
        <Icon name="tennisBall" size={14} />
        Placar do set
      </legend>
      <div className="grid grid-cols-[1fr_28px_1fr] items-end gap-2">
        <label className="grid min-w-0 gap-1.5">
          <span className="text-center text-xs font-bold uppercase tracking-wider text-sky-300">
            Time A
          </span>
          <input
            className="min-h-[52px] w-full min-w-0 rounded-xl border-2 border-slate-700 bg-slate-950 px-2 text-center text-2xl font-extrabold text-slate-50 outline-none transition focus:border-emerald-300 disabled:opacity-60"
            inputMode="numeric"
            min={0}
            type="number"
            value={teamAScore}
            disabled={disabled}
            onChange={(event) => onTeamAScoreChange(event.target.value)}
          />
        </label>

        <span className="pb-3 text-center text-lg font-bold text-slate-500">×</span>

        <label className="grid min-w-0 gap-1.5">
          <span className="text-center text-xs font-bold uppercase tracking-wider text-fuchsia-300">
            Time B
          </span>
          <input
            className="min-h-[52px] w-full min-w-0 rounded-xl border-2 border-slate-700 bg-slate-950 px-2 text-center text-2xl font-extrabold text-slate-50 outline-none transition focus:border-emerald-300 disabled:opacity-60"
            inputMode="numeric"
            min={0}
            type="number"
            value={teamBScore}
            disabled={disabled}
            onChange={(event) => onTeamBScoreChange(event.target.value)}
          />
        </label>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-slate-400">
        <Icon name="info" size={12} />
        Use 6-0 a 6-4, 7-5 ou 7-6.
      </p>
    </fieldset>
  );
}
