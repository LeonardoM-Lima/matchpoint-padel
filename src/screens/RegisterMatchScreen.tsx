import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { ErrorBanner } from '../components/ErrorBanner';
import { Icon } from '../components/Icon';
import { LeagueSelector } from '../components/LeagueSelector';
import { PlayerSelector, type SelectablePlayer } from '../components/PlayerSelector';
import { ScoreInput } from '../components/ScoreInput';
import { ScreenSkeleton } from '../components/ScreenSkeleton';
import { useEligibleLeagues } from '../hooks/useEligibleLeagues';
import { useProfile } from '../hooks/useProfile';
import { matchService, type RegisteredMatch } from '../services/match.service';
import type { Team } from '../../specs/001-matchpoint-mvp/contracts/types';

const deleteWindowSeconds = 5 * 60;

function defaultTeamForIndex(index: number): Team {
  return index < 2 ? 'A' : 'B';
}

function isValidScore(teamAScore: number, teamBScore: number) {
  const winner = Math.max(teamAScore, teamBScore);
  const loser = Math.min(teamAScore, teamBScore);

  return (winner === 6 && loser >= 0 && loser <= 4) || (winner === 7 && (loser === 5 || loser === 6));
}

function formatDelta(delta: number) {
  return delta > 0 ? `+${delta}` : String(delta);
}

export function RegisterMatchScreen() {
  const { profile, loading: profileLoading, refresh } = useProfile();
  const [selectedPlayers, setSelectedPlayers] = useState<SelectablePlayer[]>([]);
  const [teams, setTeams] = useState<Record<string, Team>>({});
  const [teamAScore, setTeamAScore] = useState('');
  const [teamBScore, setTeamBScore] = useState('');
  const [selectedLeagueId, setSelectedLeagueId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [success, setSuccess] = useState<RegisteredMatch | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  const currentPlayer = useMemo<SelectablePlayer | null>(() => {
    if (!profile) return null;

    return {
      id: profile.id,
      name: profile.name,
      points: profile.points,
      wins: profile.wins,
      losses: profile.losses,
    };
  }, [profile]);

  const matchPlayers = useMemo(
    () => (currentPlayer ? [currentPlayer, ...selectedPlayers] : selectedPlayers),
    [currentPlayer, selectedPlayers],
  );
  const matchPlayerIds = useMemo(() => matchPlayers.map((player) => player.id), [matchPlayers]);
  const { leagues: eligibleLeagues, loading: eligibleLeaguesLoading } = useEligibleLeagues(matchPlayerIds);

  useEffect(() => {
    setTeams((current) => {
      const next: Record<string, Team> = {};
      matchPlayers.forEach((player, index) => {
        next[player.id] = current[player.id] ?? defaultTeamForIndex(index);
      });
      return next;
    });
  }, [matchPlayers]);

  useEffect(() => {
    if (!selectedLeagueId) return;
    if (!eligibleLeagues.some((league) => league.id === selectedLeagueId)) {
      setSelectedLeagueId('');
    }
  }, [eligibleLeagues, selectedLeagueId]);

  useEffect(() => {
    if (!expiresAt) return undefined;

    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [expiresAt]);

  const remainingSeconds = useMemo(() => {
    if (!expiresAt) return 0;
    return Math.max(0, Math.ceil((expiresAt - now) / 1000));
  }, [expiresAt, now]);

  const teamCounts = useMemo(
    () =>
      matchPlayers.reduce(
        (counts, player) => {
          counts[teams[player.id] ?? 'A'] += 1;
          return counts;
        },
        { A: 0, B: 0 },
      ),
    [matchPlayers, teams],
  );

  const pointsPreview = useMemo(() => {
    if (selectedPlayers.length !== 3 || teamCounts.A !== 2 || teamCounts.B !== 2) return null;

    const teamA = matchPlayers.filter((p) => teams[p.id] === 'A');
    const teamB = matchPlayers.filter((p) => teams[p.id] === 'B');
    const avgA = teamA.reduce((s, p) => s + p.points, 0) / teamA.length;
    const avgB = teamB.reduce((s, p) => s + p.points, 0) / teamB.length;

    const expectedIfAWins = 1.0 / (1.0 + Math.pow(10, (avgB - avgA) / 400));
    const expectedIfBWins = 1.0 / (1.0 + Math.pow(10, (avgA - avgB) / 400));
    const deltaIfAWins = Math.round(32 * (1.0 - expectedIfAWins));
    const deltaIfBWins = Math.round(32 * (1.0 - expectedIfBWins));

    return { deltaIfAWins, deltaIfBWins };
  }, [matchPlayers, teams, teamCounts, selectedPlayers.length]);

  function assignTeam(playerId: string, team: Team) {
    setTeams((current) => ({
      ...current,
      [playerId]: team,
    }));
  }

  function validateForm() {
    if (!currentPlayer) {
      return 'Não foi possível carregar seu perfil.';
    }

    if (selectedPlayers.length !== 3) {
      return 'Selecione 4 jogadores para continuar';
    }

    if (teamCounts.A !== 2 || teamCounts.B !== 2) {
      return 'Cada time deve ter exatamente 2 jogadores';
    }

    if (teamAScore.trim() === '' || teamBScore.trim() === '') {
      return 'Informe o placar do set';
    }

    const parsedTeamAScore = Number(teamAScore);
    const parsedTeamBScore = Number(teamBScore);

    if (
      !Number.isInteger(parsedTeamAScore) ||
      !Number.isInteger(parsedTeamBScore) ||
      parsedTeamAScore < 0 ||
      parsedTeamBScore < 0 ||
      !isValidScore(parsedTeamAScore, parsedTeamBScore)
    ) {
      return 'Placar inválido — um time deve atingir 6 games';
    }

    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);

    try {
      const result = await matchService.registerMatch({
        teamAScore: Number(teamAScore),
        teamBScore: Number(teamBScore),
        leagueId: selectedLeagueId || undefined,
        players: matchPlayers.map((player) => ({
          profileId: player.id,
          team: teams[player.id] ?? 'A',
        })),
      });

      setSuccess(result);
      setExpiresAt(Date.now() + deleteWindowSeconds * 1000);
      setSelectedPlayers([]);
      setSelectedLeagueId('');
      setTeamAScore('');
      setTeamBScore('');
      await refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Não foi possível salvar a partida. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUndo() {
    if (!success || remainingSeconds <= 0) return;

    setUndoing(true);
    setError(null);
    setNotice(null);

    try {
      await matchService.deleteMatch(success.matchId);
      setSuccess(null);
      setExpiresAt(null);
      setNotice('Partida desfeita.');
      await refresh();
    } catch {
      setError('Não foi possível desfazer a partida. Tente novamente.');
    } finally {
      setUndoing(false);
    }
  }

  return (
    <main className="min-h-screen px-4 pb-28 pt-5 text-slate-50">
      <section className="mx-auto grid max-w-md gap-4 animate-fade-in">
        <header className="grid gap-3">
          <Link
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-300 hover:text-emerald-200"
            to="/"
          >
            <Icon name="arrowLeft" size={16} />
            Voltar
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-emerald shadow-glow">
              <Icon name="plusCircle" size={20} className="text-emerald-950" strokeWidth={2.4} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-300">
                MatchPoint Padel
              </p>
              <h1 className="font-display text-2xl font-extrabold text-slate-50">
                Registrar partida
              </h1>
            </div>
          </div>
        </header>

        {success ? (
          <section className="relative overflow-hidden rounded-3xl border border-emerald-300/40 bg-gradient-to-br from-emerald-500/20 via-emerald-950/40 to-slate-950 p-5 shadow-glow animate-slide-up">
            <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-emerald-300/20 blur-3xl" />
            <div className="relative flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-300 text-emerald-950 shadow-glow">
                <Icon name="checkCircle" size={26} strokeWidth={2.4} />
              </span>
              <div>
                <h2 className="text-lg font-extrabold text-emerald-100">Partida registrada!</h2>
                <p className="text-xs text-emerald-200/80">
                  Pontos atualizados para os 4 jogadores
                </p>
              </div>
            </div>

            <div className="relative mt-4 grid gap-2">
              {success.players.map((player) => (
                <div
                  key={player.profileId}
                  className="flex items-center gap-3 rounded-xl bg-slate-950/60 p-3 ring-1 ring-emerald-300/10"
                >
                  <Avatar name={player.name} size={36} />
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-50">
                      {player.name}
                    </span>
                    <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <span
                        className={`rounded px-1.5 py-0.5 font-bold ${
                          player.team === 'A'
                            ? 'bg-sky-300/15 text-sky-200'
                            : 'bg-fuchsia-300/15 text-fuchsia-200'
                        }`}
                      >
                        Time {player.team}
                      </span>
                      <span
                        className={`flex items-center gap-1 font-semibold ${
                          player.result === 'W' ? 'text-emerald-300' : 'text-rose-300'
                        }`}
                      >
                        <Icon
                          name={player.result === 'W' ? 'trophy' : 'xCircle'}
                          size={11}
                        />
                        {player.result === 'W' ? 'Vitória' : 'Derrota'}
                      </span>
                    </span>
                  </div>
                  <div className="text-right">
                    <strong className="block text-sm font-bold text-slate-50">
                      {player.pointsAfter}
                    </strong>
                    <span
                      className={`text-xs font-bold ${
                        player.pointsDelta >= 0 ? 'text-emerald-300' : 'text-rose-300'
                      }`}
                    >
                      {formatDelta(player.pointsDelta)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <button
              className="relative mt-4 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-slate-50 px-4 font-bold text-slate-950 transition hover:bg-white disabled:opacity-60"
              type="button"
              disabled={undoing || remainingSeconds <= 0}
              onClick={() => {
                void handleUndo();
              }}
            >
              <Icon name="undo" size={18} />
              {undoing ? 'Desfazendo...' : `Desfazer (${remainingSeconds}s)`}
            </button>
          </section>
        ) : null}

        {notice ? (
          <p className="flex items-center gap-2 rounded-xl border border-emerald-300/40 bg-emerald-950/40 px-3 py-3 text-sm text-emerald-100">
            <Icon name="checkCircle" size={18} className="text-emerald-300" />
            {notice}
          </p>
        ) : null}

        {profileLoading ? <ScreenSkeleton rows={2} /> : null}

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <PlayerSelector
            selectedPlayers={selectedPlayers}
            disabled={submitting || profileLoading}
            excludePlayerId={currentPlayer?.id}
            maxPlayers={3}
            onChange={setSelectedPlayers}
          />

          {matchPlayers.length > 0 ? (
            <section className="grid gap-2.5 rounded-xl border border-slate-800/80 bg-slate-900/40 p-3.5">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-emerald-300">
                  <Icon name="users" size={14} />
                  Times
                </h2>
                <div className="flex gap-1.5 text-[11px]">
                  <span
                    className={`rounded-full px-2 py-0.5 font-bold ${
                      teamCounts.A === 2
                        ? 'bg-sky-300/15 text-sky-200 ring-1 ring-sky-300/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    A: {teamCounts.A}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 font-bold ${
                      teamCounts.B === 2
                        ? 'bg-fuchsia-300/15 text-fuchsia-200 ring-1 ring-fuchsia-300/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    B: {teamCounts.B}
                  </span>
                </div>
              </div>

              <div className="grid gap-2">
                {matchPlayers.map((player, index) => {
                  const activeTeam = teams[player.id] ?? defaultTeamForIndex(index);
                  const isCurrentPlayer = currentPlayer?.id === player.id;

                  return (
                    <div
                      key={player.id}
                      className="flex items-center gap-3 rounded-lg bg-slate-950 p-2.5 ring-1 ring-slate-800/60"
                    >
                      <Avatar name={player.name} size={36} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-50">
                          {player.name}
                          {isCurrentPlayer ? (
                            <span className="ml-1 rounded bg-emerald-300/20 px-1 py-0.5 text-[9px] font-bold uppercase text-emerald-200">
                              Você
                            </span>
                          ) : null}
                        </span>
                        <span className="text-[11px] text-slate-400">{player.points} pts</span>
                      </span>

                      <span className="grid grid-cols-2 gap-1.5 rounded-lg bg-slate-900 p-1 ring-1 ring-slate-800/60">
                        {(['A', 'B'] as Team[]).map((team) => (
                          <button
                            key={team}
                            className={[
                              'min-h-[36px] min-w-[40px] rounded-md px-3 text-sm font-bold transition',
                              activeTeam === team
                                ? team === 'A'
                                  ? 'bg-sky-300 text-sky-950'
                                  : 'bg-fuchsia-300 text-fuchsia-950'
                                : 'text-slate-400 hover:text-slate-200',
                            ].join(' ')}
                            type="button"
                            disabled={submitting}
                            onClick={() => assignTeam(player.id, team)}
                          >
                            {team}
                          </button>
                        ))}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {pointsPreview ? (
            <section className="grid grid-cols-2 gap-2 rounded-xl border border-slate-800/80 bg-slate-900/40 p-3">
              <div className="flex flex-col items-center gap-0.5 rounded-lg bg-slate-950 py-2.5 ring-1 ring-sky-300/20">
                <span className="text-[10px] font-bold uppercase tracking-wide text-sky-300">Time A vence</span>
                <span className="text-base font-extrabold text-emerald-300">+{pointsPreview.deltaIfAWins}</span>
                <span className="text-[10px] text-rose-300">Time B: −{pointsPreview.deltaIfAWins}</span>
              </div>
              <div className="flex flex-col items-center gap-0.5 rounded-lg bg-slate-950 py-2.5 ring-1 ring-fuchsia-300/20">
                <span className="text-[10px] font-bold uppercase tracking-wide text-fuchsia-300">Time B vence</span>
                <span className="text-base font-extrabold text-emerald-300">+{pointsPreview.deltaIfBWins}</span>
                <span className="text-[10px] text-rose-300">Time A: −{pointsPreview.deltaIfBWins}</span>
              </div>
            </section>
          ) : null}

          <LeagueSelector
            leagues={eligibleLeagues}
            value={selectedLeagueId}
            disabled={matchPlayers.length !== 4 || submitting || profileLoading}
            loading={eligibleLeaguesLoading}
            onChange={setSelectedLeagueId}
          />

          <ScoreInput
            teamAScore={teamAScore}
            teamBScore={teamBScore}
            disabled={submitting || profileLoading}
            onTeamAScoreChange={setTeamAScore}
            onTeamBScoreChange={setTeamBScore}
          />

          {error ? <ErrorBanner message={error} /> : null}

          <button
            className="btn-primary inline-flex min-h-[56px] items-center justify-center gap-2 rounded-xl px-4 disabled:opacity-60"
            type="submit"
            disabled={submitting || profileLoading}
          >
            {submitting ? (
              'Salvando...'
            ) : (
              <>
                <Icon name="check" size={20} strokeWidth={2.6} />
                Salvar partida
              </>
            )}
          </button>
        </form>
      </section>
    </main>
  );
}
