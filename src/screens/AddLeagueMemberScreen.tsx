import { useEffect, useState } from 'react';
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
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { detail, refresh } = useLeague(id);

  const memberIds = new Set([
    ...(detail?.ranking.map((entry) => entry.profileId) ?? []),
    ...Array.from(addedIds),
  ]);

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
        if (active) setError('Nao foi possivel buscar jogadores.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [query]);

  async function handleAdd(profileId: string) {
    if (!id) return;
    setAddingId(profileId);
    setError(null);
    setNotice(null);

    try {
      await leagueService.addMember(id, profileId);
      setAddedIds((current) => new Set(current).add(profileId));
      setNotice('Jogador adicionado.');
      await refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Nao foi possivel adicionar o jogador.');
    } finally {
      setAddingId(null);
    }
  }

  return (
    <main className="min-h-screen px-4 pb-32 pt-6 text-slate-50">
      <section className="mx-auto grid max-w-md gap-5 animate-fade-in">
        <header className="grid gap-3">
          <Link className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-300" to={id ? `/leagues/${id}` : '/leagues'}>
            <Icon name="arrowLeft" size={16} />
            Voltar
          </Link>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">Liga privada</p>
            <h1 className="font-display text-3xl font-extrabold text-slate-50">Adicionar membros</h1>
          </div>
        </header>

        <div className="relative">
          <Icon name="search" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            className="min-h-[48px] w-full rounded-xl border border-slate-700 bg-slate-950 pl-10 pr-3 text-slate-50 outline-none transition focus:border-emerald-300"
            placeholder="Buscar por nickname"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
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
            const alreadyMember = memberIds.has(player.id);

            return (
              <article
                key={player.id}
                className={[
                  'flex items-center gap-3 rounded-2xl border p-3',
                  alreadyMember
                    ? 'border-emerald-300/30 bg-emerald-400/10'
                    : 'border-slate-800/80 bg-slate-900/60',
                ].join(' ')}
              >
                <Avatar name={player.name} avatarUrl={player.avatarUrl} size={42} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-sm font-bold text-slate-50">{player.name}</h2>
                    <CategoryBadge category={player.category} />
                  </div>
                  <p className="text-[11px] text-slate-400">{player.points} pts · {player.wins}V / {player.losses}D</p>
                </div>
                <button
                  className={[
                    'inline-flex h-10 min-w-10 items-center justify-center rounded-xl px-3 text-sm font-bold disabled:opacity-70',
                    alreadyMember
                      ? 'bg-slate-800 text-slate-300'
                      : 'bg-emerald-400 text-emerald-950',
                  ].join(' ')}
                  type="button"
                  disabled={alreadyMember || addingId === player.id}
                  onClick={() => void handleAdd(player.id)}
                  aria-label={alreadyMember ? `${player.name} ja esta na liga` : `Adicionar ${player.name}`}
                >
                  {alreadyMember ? (
                    <span className="flex items-center gap-1">
                      <Icon name="check" size={14} />
                      Na liga
                    </span>
                  ) : (
                    <Icon name="plus" size={18} />
                  )}
                </button>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
