import { Link } from 'react-router-dom';
import type { LeagueDTO } from '../../specs/002-perfil-e-ligas/contracts/types';
import { supabase } from '../lib/supabase';
import { Icon } from './Icon';

interface LeagueCardProps {
  league: LeagueDTO;
}

function coverUrl(path?: string) {
  if (!path) return null;
  return supabase.storage.from('league-covers').getPublicUrl(path).data.publicUrl;
}

export function LeagueCard({ league }: LeagueCardProps) {
  const url = coverUrl(league.coverUrl);

  return (
    <Link
      className="grid gap-3 overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/60 p-3 transition hover:border-emerald-300/40"
      to={`/leagues/${league.id}`}
    >
      <div className="flex h-28 items-center justify-center overflow-hidden rounded-xl bg-slate-950 ring-1 ring-slate-800/80">
        {url ? (
          <img className="h-full w-full object-cover" src={url} alt="" />
        ) : (
          <Icon name="trophy" size={34} className="text-emerald-300" />
        )}
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-extrabold text-slate-50">{league.name}</h2>
          <p className="text-xs text-slate-400">{league.memberCount} membros</p>
        </div>
        {league.isOwner ? (
          <span className="rounded-full bg-emerald-300/15 px-2.5 py-1 text-[10px] font-bold text-emerald-200 ring-1 ring-emerald-300/30">
            Dono
          </span>
        ) : null}
      </div>
    </Link>
  );
}
