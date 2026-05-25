import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import { Icon } from '../components/Icon';
import { LeagueRankingRow } from '../components/LeagueRankingRow';
import { ScreenSkeleton } from '../components/ScreenSkeleton';
import { useLeague } from '../hooks/useLeague';
import { useProfile } from '../hooks/useProfile';
import { supabase } from '../lib/supabase';
import { leagueService } from '../services/league.service';

function coverUrl(path?: string) {
  if (!path) return null;
  return supabase.storage.from('league-covers').getPublicUrl(path).data.publicUrl;
}

export function LeagueDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useProfile();
  const { detail, loading, error, refresh } = useLeague(id);
  const [removeMode, setRemoveMode] = useState(false);
  const [selectedRemoveIds, setSelectedRemoveIds] = useState<Set<string>>(new Set());
  const [removingMembers, setRemovingMembers] = useState(false);

  async function handleDelete() {
    if (!id || !window.confirm('Excluir esta liga?')) return;
    await leagueService.deleteLeague(id);
    navigate('/leagues');
  }

  async function handleLeaveOrRemove(profileId: string) {
    if (!id || !window.confirm('Remover jogador da liga?')) return;
    await leagueService.removeMember(id, profileId);
    if (profileId === profile?.id) {
      navigate('/leagues');
      return;
    }
    await refresh();
  }

  async function handleRemoveSelected() {
    if (!id || selectedRemoveIds.size === 0) return;
    const count = selectedRemoveIds.size;
    if (!window.confirm(`Remover ${count} ${count === 1 ? 'jogador' : 'jogadores'} da liga?`)) return;

    setRemovingMembers(true);
    try {
      for (const profileId of selectedRemoveIds) {
        await leagueService.removeMember(id, profileId);
      }
      setSelectedRemoveIds(new Set());
      setRemoveMode(false);
      await refresh();
    } finally {
      setRemovingMembers(false);
    }
  }

  function toggleSelectedMember(profileId: string) {
    setSelectedRemoveIds((current) => {
      const next = new Set(current);
      if (next.has(profileId)) {
        next.delete(profileId);
      } else {
        next.add(profileId);
      }
      return next;
    });
  }

  const cover = coverUrl(detail?.league.coverUrl);

  return (
    <main className="min-h-screen px-4 pb-32 pt-6 text-slate-50">
      <section className="mx-auto grid max-w-md gap-5 animate-fade-in">
        <header className="grid gap-3">
          <Link className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-300" to="/leagues">
            <Icon name="arrowLeft" size={16} />
            Voltar
          </Link>
        </header>

        {loading ? <ScreenSkeleton rows={4} /> : null}
        {error ? <ErrorBanner message={error} /> : null}

        {!loading && detail ? (
          <>
            <section className="overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-900/60 shadow-soft">
              <div className="flex h-40 items-center justify-center bg-slate-950">
                {cover ? (
                  <img className="h-full w-full object-cover" src={cover} alt="" />
                ) : (
                  <Icon name="trophy" size={42} className="text-emerald-300" />
                )}
              </div>
              <div className="grid gap-4 p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="min-w-0 flex-1 truncate font-display text-3xl font-extrabold text-slate-50">
                      {detail.league.name}
                    </h1>
                    {detail.permissions.isOwner ? (
                      <span className="rounded-full bg-emerald-300/15 px-2.5 py-1 text-[10px] font-bold text-emerald-200 ring-1 ring-emerald-300/30">
                        Dono
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-slate-400">{detail.league.memberCount} membros</p>
                </div>

                <div className="grid gap-2">
                  {detail.permissions.canAddMember ? (
                    <div className="grid grid-cols-2 gap-2">
                      <Link className="btn-primary inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4" to={`/leagues/${detail.league.id}/add-member`}>
                        <Icon name="plus" size={16} />
                        Membros
                      </Link>
                      <Link
                        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-emerald-300/40 bg-emerald-400/10 px-4 font-bold text-emerald-200"
                        to={`/leagues/${detail.league.id}/edit`}
                      >
                        <Icon name="user" size={16} />
                        Editar
                      </Link>
                    </div>
                  ) : null}

                  <Link
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-sky-300/40 bg-sky-400/10 px-4 font-bold text-sky-200"
                    to={`/leagues/${detail.league.id}/history`}
                  >
                    <Icon name="chartBar" size={16} />
                    Ver histórico da liga
                  </Link>

                  {detail.permissions.canLeave ? (
                    <button className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-rose-300/40 bg-rose-400/10 px-4 font-bold text-rose-200" type="button" onClick={() => void handleLeaveOrRemove(profile!.id)}>
                      <Icon name="x" size={16} />
                      Sair da liga
                    </button>
                  ) : null}

                  {detail.permissions.canDelete ? (
                    <button className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-rose-300/40 bg-rose-400/10 px-4 font-bold text-rose-200" type="button" onClick={() => void handleDelete()}>
                      <Icon name="xCircle" size={16} />
                      Excluir liga
                    </button>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="grid gap-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-emerald-300">
                  <Icon name="chartBar" size={16} />
                  Ranking da liga
                </h2>
                {detail.permissions.isOwner && detail.ranking.some((entry) => entry.profileId !== detail.league.ownerId) ? (
                  <button
                    className="inline-flex min-h-9 items-center justify-center rounded-lg px-3 text-xs font-bold text-rose-200 ring-1 ring-rose-300/30"
                    type="button"
                    onClick={() => {
                      setRemoveMode((current) => !current);
                      setSelectedRemoveIds(new Set());
                    }}
                  >
                    {removeMode ? 'Cancelar' : 'Remover participante'}
                  </button>
                ) : null}
              </div>

              {removeMode ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-300/30 bg-rose-400/10 px-3 py-2">
                  <span className="text-xs font-semibold text-rose-100">
                    {selectedRemoveIds.size} selecionado(s)
                  </span>
                  <button
                    className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-rose-400 px-3 text-xs font-bold text-rose-950 disabled:opacity-60"
                    type="button"
                    disabled={selectedRemoveIds.size === 0 || removingMembers}
                    onClick={() => void handleRemoveSelected()}
                  >
                    <Icon name="xCircle" size={14} />
                    {removingMembers ? 'Removendo...' : 'Remover selecionados'}
                  </button>
                </div>
              ) : null}

              {detail.ranking.length === 0 ? (
                <EmptyState
                  icon="users"
                  title="Nenhum membro na liga"
                  description="Quando houver participantes, o ranking aparece aqui."
                />
              ) : null}

              {detail.ranking.map((entry) => (
                <label
                  key={entry.profileId}
                  className={[
                    'grid gap-2',
                    removeMode && entry.profileId !== detail.league.ownerId ? 'cursor-pointer' : '',
                  ].join(' ')}
                >
                  <div className="relative">
                    {removeMode && entry.profileId !== detail.league.ownerId ? (
                      <input
                        className="absolute right-3 top-1/2 z-10 h-5 w-5 -translate-y-1/2 accent-rose-400"
                        type="checkbox"
                        checked={selectedRemoveIds.has(entry.profileId)}
                        onChange={() => toggleSelectedMember(entry.profileId)}
                      />
                    ) : null}
                    <LeagueRankingRow entry={entry} />
                  </div>
                </label>
              ))}
            </section>

          </>
        ) : null}
      </section>
    </main>
  );
}
