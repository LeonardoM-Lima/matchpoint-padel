import type { EligibleLeague } from '../../specs/002-perfil-e-ligas/contracts/types';
import { Icon } from './Icon';

interface LeagueSelectorProps {
  leagues: EligibleLeague[];
  value: string;
  disabled?: boolean;
  loading?: boolean;
  onChange: (leagueId: string) => void;
}

export function LeagueSelector({ leagues, value, disabled = false, loading = false, onChange }: LeagueSelectorProps) {
  return (
    <section className="grid gap-2 rounded-xl border border-slate-800/80 bg-slate-900/40 p-3">
      <label
        className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-emerald-300"
        htmlFor="league-selector"
      >
        <Icon name="trophy" size={14} />
        Vincular a uma liga
      </label>
      <select
        id="league-selector"
        className="min-h-[44px] w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm font-semibold text-slate-50 outline-none transition focus:border-emerald-300 disabled:opacity-60"
        value={value}
        disabled={disabled || loading}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Nenhuma</option>
        {leagues.map((league) => (
          <option key={league.id} value={league.id}>
            {league.name}
          </option>
        ))}
      </select>
      <p className="text-[11px] text-slate-400">
        {disabled
          ? 'Disponivel apos selecionar os 4 jogadores.'
          : loading
            ? 'Buscando ligas elegiveis...'
            : leagues.length === 0
              ? 'Nenhuma liga com todos estes jogadores.'
              : `${leagues.length} liga(s) elegivel(is).`}
      </p>
    </section>
  );
}
