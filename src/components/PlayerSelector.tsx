import { useEffect, useMemo, useState } from 'react';
import { Avatar } from './Avatar';
import { EmptyState } from './EmptyState';
import { ErrorBanner } from './ErrorBanner';
import { Icon } from './Icon';
import { ScreenSkeleton } from './ScreenSkeleton';
import { supabase } from '../lib/supabase';

export interface SelectablePlayer {
  id: string;
  name: string;
  points: number;
  wins: number;
  losses: number;
}

interface PlayerRow {
  id: string;
  name: string;
  points: number;
  wins: number;
  losses: number;
}

interface PlayerSelectorProps {
  selectedPlayers: SelectablePlayer[];
  disabled?: boolean;
  excludePlayerId?: string;
  maxPlayers?: number;
  onChange: (players: SelectablePlayer[]) => void;
}

function mapPlayer(row: PlayerRow): SelectablePlayer {
  return {
    id: row.id,
    name: row.name,
    points: row.points,
    wins: row.wins,
    losses: row.losses,
  };
}

export function PlayerSelector({
  selectedPlayers,
  disabled = false,
  excludePlayerId,
  maxPlayers = 4,
  onChange,
}: PlayerSelectorProps) {
  const [search, setSearch] = useState('');
  const [players, setPlayers] = useState<SelectablePlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedIds = useMemo(
    () => new Set(selectedPlayers.map((player) => player.id)),
    [selectedPlayers],
  );

  useEffect(() => {
    let active = true;

    async function loadPlayers() {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('profiles')
        .select('id,name,points,wins,losses')
        .order('name', { ascending: true })
        .limit(20);

      const trimmedSearch = search.trim();
      if (trimmedSearch) {
        query = query.ilike('name', `%${trimmedSearch}%`);
      }

      const { data, error: nextError } = await query;

      if (!active) return;

      if (nextError) {
        setError('Nao foi possivel carregar os jogadores.');
        setPlayers([]);
      } else {
        const nextPlayers = (data as PlayerRow[])
          .map(mapPlayer)
          .filter((player) => player.id !== excludePlayerId);

        setPlayers(nextPlayers);
      }

      setLoading(false);
    }

    void loadPlayers();

    return () => {
      active = false;
    };
  }, [excludePlayerId, search]);

  function togglePlayer(player: SelectablePlayer) {
    if (disabled) return;

    if (selectedIds.has(player.id)) {
      onChange(selectedPlayers.filter((selected) => selected.id !== player.id));
      return;
    }

    if (selectedPlayers.length >= maxPlayers) return;
    onChange([...selectedPlayers, player]);
  }

  return (
    <section className="grid gap-2.5 rounded-xl border border-slate-800/80 bg-slate-900/40 p-3">
      <div className="grid gap-2">
        <label
          className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-emerald-300"
          htmlFor="player-search"
        >
          <Icon name="users" size={14} />
          Adversários e parceiros
        </label>
        <div className="relative">
          <Icon
            name="search"
            size={18}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <input
            id="player-search"
            className="min-h-[44px] w-full rounded-xl border border-slate-700 bg-slate-950 pl-10 pr-3 text-slate-50 outline-none transition focus:border-emerald-300 disabled:opacity-60"
            placeholder="Buscar por nome"
            type="search"
            value={search}
            disabled={disabled}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-300/10 px-2.5 py-1 font-semibold text-emerald-200 ring-1 ring-emerald-300/20">
          <Icon name="checkCircle" size={12} />
          {selectedPlayers.length}/{maxPlayers} selecionados
        </span>
        {loading ? <span className="text-slate-400">Carregando...</span> : null}
      </div>

      {error ? <ErrorBanner message={error} /> : null}

      <div className="grid max-h-72 gap-2 overflow-y-auto pr-1">
        {loading ? <ScreenSkeleton rows={2} /> : null}

        {players.map((player) => {
          const selected = selectedIds.has(player.id);
          const blocked = !selected && selectedPlayers.length >= maxPlayers;

          return (
            <button
              key={player.id}
              className={[
                'flex min-h-[48px] items-center gap-2.5 rounded-lg border px-2.5 py-1.5 text-left transition',
                selected
                  ? 'border-emerald-300 bg-emerald-300/15 shadow-glow'
                  : 'border-slate-800 bg-slate-950 hover:border-emerald-300/40',
                blocked || disabled ? 'opacity-60' : '',
              ].join(' ')}
              type="button"
              disabled={disabled || blocked}
              onClick={() => togglePlayer(player)}
            >
              <Avatar name={player.name} size={34} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-50">{player.name}</span>
                <span className="text-[11px] text-slate-400">
                  {player.points} pts · {player.wins}V / {player.losses}D
                </span>
              </span>
              <span
                className={[
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                  selected
                    ? 'bg-emerald-300 text-emerald-950'
                    : 'bg-slate-800 text-slate-400',
                ].join(' ')}
              >
                <Icon name={selected ? 'check' : 'plus'} size={14} strokeWidth={2.6} />
              </span>
            </button>
          );
        })}

        {!loading && players.length === 0 ? (
          <EmptyState
            icon="search"
            title="Nenhum jogador encontrado"
            description="Revise a busca ou cadastre novos jogadores."
          />
        ) : null}
      </div>
    </section>
  );
}
