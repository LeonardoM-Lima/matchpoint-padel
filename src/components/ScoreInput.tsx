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
    <fieldset className="grid gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <legend className="px-1 text-sm font-semibold text-slate-100">Placar</legend>
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
        <label className="grid gap-2">
          <span className="text-sm text-slate-300">Time A</span>
          <input
            className="min-h-[44px] rounded-lg border border-slate-700 bg-slate-950 px-3 text-center text-lg font-semibold text-slate-50 outline-none focus:border-emerald-300 disabled:opacity-60"
            inputMode="numeric"
            min={0}
            type="number"
            value={teamAScore}
            disabled={disabled}
            onChange={(event) => onTeamAScoreChange(event.target.value)}
          />
        </label>

        <span className="pb-3 text-lg font-bold text-slate-400">x</span>

        <label className="grid gap-2">
          <span className="text-sm text-slate-300">Time B</span>
          <input
            className="min-h-[44px] rounded-lg border border-slate-700 bg-slate-950 px-3 text-center text-lg font-semibold text-slate-50 outline-none focus:border-emerald-300 disabled:opacity-60"
            inputMode="numeric"
            min={0}
            type="number"
            value={teamBScore}
            disabled={disabled}
            onChange={(event) => onTeamBScoreChange(event.target.value)}
          />
        </label>
      </div>
      <p className="text-xs text-slate-400">Use 6-0 a 6-4, 7-5 ou 7-6.</p>
    </fieldset>
  );
}
