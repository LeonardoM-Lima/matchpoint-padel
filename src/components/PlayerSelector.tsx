import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from './EmptyState';
import { ErrorBanner } from './ErrorBanner';
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
    <section className="grid gap-3">
      <div className="grid gap-2">
        <label className="text-sm font-semibold text-slate-200" htmlFor="player-search">
          Jogadores
        </label>
        <input
          id="player-search"
          className="min-h-[44px] rounded-lg border border-slate-700 bg-slate-950 px-3 text-slate-50 outline-none focus:border-emerald-300 disabled:opacity-60"
          placeholder="Buscar por nome"
          type="search"
          value={search}
          disabled={disabled}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="flex items-center justify-between text-sm text-slate-400">
        <span>{selectedPlayers.length}/{maxPlayers} selecionados</span>
        {loading ? <span>Carregando...</span> : null}
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
                'flex min-h-[56px] items-center justify-between rounded-lg border px-3 py-2 text-left transition',
                selected
                  ? 'border-emerald-300 bg-emerald-300 text-slate-950'
                  : 'border-slate-800 bg-slate-900 text-slate-100',
                blocked || disabled ? 'opacity-60' : '',
              ].join(' ')}
              type="button"
              disabled={disabled || blocked}
              onClick={() => togglePlayer(player)}
            >
              <span>
                <span className="block font-semibold">{player.name}</span>
                <span className={selected ? 'text-slate-800' : 'text-slate-400'}>
                  {player.points} pontos
                </span>
              </span>
              <span className="text-sm font-semibold">{selected ? 'Selecionado' : 'Adicionar'}</span>
            </button>
          );
        })}

        {!loading && players.length === 0 ? (
          <EmptyState
            title="Nenhum jogador encontrado"
            description="Revise a busca ou cadastre novos jogadores."
          />
        ) : null}
      </div>
    </section>
  );
}
