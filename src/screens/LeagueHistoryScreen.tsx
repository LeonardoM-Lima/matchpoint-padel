import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import { Icon } from '../components/Icon';
import { ScreenSkeleton } from '../components/ScreenSkeleton';
import { useLeague } from '../hooks/useLeague';
import { leagueService, type LeagueMatchHistoryEntry } from '../services/league.service';

function formatDate(iso: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function LeagueHistoryScreen() {
  const { id } = useParams();
  const { detail, loading: leagueLoading, error: leagueError } = useLeague(id);
  const [history, setHistory] = useState<LeagueMatchHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    setError(null);

    leagueService
      .getLeagueMatchHistory(id)
      .then(setHistory)
      .catch(() => setError('Nao foi possivel carregar o historico da liga.'))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <main className="min-h-screen px-4 pb-32 pt-6 text-slate-50">
      <section className="mx-auto grid max-w-md gap-5 animate-fade-in">
        <header className="grid gap-3">
          <Link
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-300"
            to={id ? `/leagues/${id}` : '/leagues'}
          >
            <Icon name="arrowLeft" size={16} />
            Voltar
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-emerald-500 shadow-soft">
              <Icon name="racket" size={22} strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">
                {detail?.league.name ?? 'Liga privada'}
              </p>
              <h1 className="font-display text-3xl font-extrabold text-slate-50">Histórico</h1>
            </div>
          </div>
        </header>

        {leagueLoading || loading ? <ScreenSkeleton rows={4} /> : null}
        {leagueError ? <ErrorBanner message={leagueError} /> : null}
        {error ? <ErrorBanner message={error} /> : null}

        {!leagueLoading && !loading && !leagueError && !error && history.length === 0 ? (
          <EmptyState
            icon="racket"
            title="Nenhuma partida vinculada"
            description="Quando uma partida for registrada nesta liga, ela aparece aqui."
          />
        ) : null}

        {!loading && history.length > 0 ? (
          <section className="grid gap-3">
            {history.map((match) => (
              <article
                key={match.matchId}
                className="grid gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4"
              >
                <header className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {formatDate(match.playedAt)}
                  </span>
                  <span className="rounded-full bg-emerald-300/15 px-2 py-0.5 text-[10px] font-bold text-emerald-200 ring-1 ring-emerald-300/30">
                    Time {match.winnerTeam} venceu
                  </span>
                </header>

                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <div className="min-w-0 text-sm">
                    <span className="block text-[10px] font-bold uppercase tracking-wide text-sky-300">
                      Time A
                    </span>
                    <span className="block truncate text-slate-200">
                      {match.teamAPlayers.join(' / ')}
                    </span>
                  </div>

                  <div className="rounded-xl bg-slate-950 px-3 py-2 text-center ring-1 ring-slate-800">
                    <strong className="text-lg font-extrabold text-slate-50">
                      {match.teamAScore}×{match.teamBScore}
                    </strong>
                  </div>

                  <div className="min-w-0 text-right text-sm">
                    <span className="block text-[10px] font-bold uppercase tracking-wide text-fuchsia-300">
                      Time B
                    </span>
                    <span className="block truncate text-slate-200">
                      {match.teamBPlayers.join(' / ')}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </section>
        ) : null}
      </section>
    </main>
  );
}
