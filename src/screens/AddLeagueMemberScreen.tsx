import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { CategoryBadge } from '../components/CategoryBadge';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import { Icon } from '../components/Icon';
import { ScreenSkeleton } from '../components/ScreenSkeleton';
import { useLeague } from '../hooks/useLeague';
import { leagueService, type ProfileSearchResult } from '../services/league.service';

export function AddLeagueMemberScreen() {
  const { id } = useParams();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProfileSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedAddIds, setSelectedAddIds] = useState<Set<string>>(new Set());
  const [selectedRemoveIds, setSelectedRemoveIds] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { detail, refresh } = useLeague(id);

  const memberIds = useMemo(
    () => new Set(detail?.ranking.map((entry) => entry.profileId) ?? []),
    [detail?.ranking],
  );
  const ownerId = detail?.league.ownerId;
  const hasChanges = selectedAddIds.size > 0 || selectedRemoveIds.size > 0;

  useEffect(() => {
    let active = true;
    const trimmed = query.trim();

    setLoading(true);
    setError(null);
    leagueService
      .searchProfiles(trimmed)
      .then((nextResults) => {
        if (active) setResults(nextResults);
      })
      .catch(() => {
        if (active) setError('Não foi possível buscar jogadores.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [query]);

  function togglePlayer(profileId: string) {
    setNotice(null);
    setError(null);

    if (memberIds.has(profileId)) {
      if (profileId === ownerId) return;

      setSelectedRemoveIds((current) => {
        const next = new Set(current);
        if (next.has(profileId)) {
          next.delete(profileId);
        } else {
          next.add(profileId);
        }
        return next;
      });
      return;
    }

    setSelectedAddIds((current) => {
      const next = new Set(current);
      if (next.has(profileId)) {
        next.delete(profileId);
      } else {
        next.add(profileId);
      }
      return next;
    });
  }

  async function handleSave() {
    if (!id || !hasChanges) return;

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      for (const profileId of selectedRemoveIds) {
        await leagueService.removeMember(id, profileId);
      }
      for (const profileId of selectedAddIds) {
        await leagueService.addMember(id, profileId);
      }

      setSelectedAddIds(new Set());
      setSelectedRemoveIds(new Set());
      setNotice('Membros atualizados.');
      await refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Não foi possível salvar os membros.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen px-4 pb-32 pt-6 text-slate-50">
      <section className="mx-auto grid max-w-md animate-fade-in gap-5">
        <header className="grid gap-3">
          <Link
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-300"
            to={id ? `/leagues/${id}` : '/leagues'}
          >
            <Icon name="arrowLeft" size={16} />
            Voltar
          </Link>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">
              Liga privada
            </p>
            <h1 className="font-display text-3xl font-extrabold text-slate-50">Adicionar membros</h1>
          </div>
        </header>

        <div className="grid gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-3">
          <div className="relative">
            <Icon
              name="search"
              size={18}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              className="min-h-[48px] w-full rounded-xl border border-slate-700 bg-slate-950 pl-10 pr-3 text-slate-50 outline-none transition focus:border-emerald-300"
              placeholder="Buscar por nickname"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-400">
              {selectedAddIds.size} para adicionar · {selectedRemoveIds.size} para remover
            </span>
            <button
              type="button"
              className="btn-primary inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm disabled:opacity-60"
              disabled={!hasChanges || saving}
              onClick={() => {
                void handleSave();
              }}
            >
              <Icon name="checkCircle" size={16} />
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>

        {notice ? (
          <p className="flex items-center gap-2 rounded-xl border border-emerald-300/40 bg-emerald-950/40 px-3 py-3 text-sm text-emerald-100">
            <Icon name="checkCircle" size={18} className="text-emerald-300" />
            {notice}
          </p>
        ) : null}

        {error ? <ErrorBanner message={error} /> : null}
        {loading ? <ScreenSkeleton rows={2} /> : null}

        {!loading && results.length === 0 ? (
          <EmptyState icon="search" title="Nenhum resultado" description="Revise o nickname e tente novamente." />
        ) : null}

        <div className="grid gap-2">
          {results.map((player) => {
            const isMember = memberIds.has(player.id);
            const selectedAdd = selectedAddIds.has(player.id);
            const selectedRemove = selectedRemoveIds.has(player.id);
            const isOwner = player.id === ownerId;

            return (
              <button
                key={player.id}
                type="button"
                disabled={isOwner}
                className={[
                  'flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition disabled:cursor-not-allowed',
                  selectedAdd
                    ? 'border-emerald-300/60 bg-emerald-400/15'
                    : selectedRemove
                      ? 'border-rose-300/60 bg-rose-400/15'
                      : isMember
                        ? 'border-emerald-300/30 bg-emerald-400/10'
                        : 'border-slate-800/80 bg-slate-900/60 hover:border-emerald-300/30',
                ].join(' ')}
                onClick={() => togglePlayer(player.id)}
                aria-pressed={selectedAdd || selectedRemove}
              >
                <Avatar name={player.name} avatarUrl={player.avatarUrl} size={42} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-sm font-bold text-slate-50">{player.name}</h2>
                    <CategoryBadge category={player.category} />
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {player.points} pts · {player.wins}V / {player.losses}D
                  </p>
                </div>
                <span
                  className={[
                    'inline-flex min-h-10 items-center justify-center gap-1 rounded-xl px-3 text-xs font-bold',
                    selectedAdd
                      ? 'bg-emerald-400 text-emerald-950'
                      : selectedRemove
                        ? 'bg-rose-400 text-rose-950'
                        : isMember
                          ? 'bg-slate-800 text-slate-300'
                          : 'bg-emerald-400 text-emerald-950',
                  ].join(' ')}
                >
                  {isOwner ? (
                    'Dono'
                  ) : selectedAdd ? (
                    <>
                      <Icon name="check" size={14} />
                      Adicionar
                    </>
                  ) : selectedRemove ? (
                    <>
                      <Icon name="x" size={14} />
                      Remover
                    </>
                  ) : isMember ? (
                    'Na liga'
                  ) : (
                    <>
                      <Icon name="plus" size={14} />
                      Adicionar
                    </>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}
