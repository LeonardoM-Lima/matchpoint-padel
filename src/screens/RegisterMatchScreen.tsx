import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorBanner } from '../components/ErrorBanner';
import { PlayerSelector, type SelectablePlayer } from '../components/PlayerSelector';
import { ScoreInput } from '../components/ScoreInput';
import { ScreenSkeleton } from '../components/ScreenSkeleton';
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

  function assignTeam(playerId: string, team: Team) {
    setTeams((current) => ({
      ...current,
      [playerId]: team,
    }));
  }

  function validateForm() {
    if (!currentPlayer) {
      return 'Nao foi possivel carregar seu perfil.';
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
      return 'Placar invalido - um time deve atingir 6 games';
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
        players: matchPlayers.map((player) => ({
          profileId: player.id,
          team: teams[player.id] ?? 'A',
        })),
      });

      setSuccess(result);
      setExpiresAt(Date.now() + deleteWindowSeconds * 1000);
      setSelectedPlayers([]);
      setTeamAScore('');
      setTeamBScore('');
      await refresh();
    } catch {
      setError('Nao foi possivel salvar a partida. Tente novamente.');
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
      setError('Nao foi possivel desfazer a partida. Tente novamente.');
    } finally {
      setUndoing(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 pb-28 pt-6 text-slate-50">
      <section className="mx-auto grid max-w-md gap-6">
        <header className="grid gap-3">
          <Link className="text-sm font-semibold text-emerald-300" to="/">
            Voltar
          </Link>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-300">
              MatchPoint Padel
            </p>
            <h1 className="text-3xl font-bold">Registrar partida</h1>
          </div>
        </header>

        {success ? (
          <section className="grid gap-4 rounded-lg border border-emerald-300/40 bg-emerald-950/30 p-4">
            <div>
              <h2 className="text-xl font-bold text-emerald-100">Partida registrada</h2>
              <p className="text-sm text-emerald-100/80">Pontos atualizados para os 4 jogadores.</p>
            </div>

            <div className="grid gap-2">
              {success.players.map((player) => (
                <div
                  key={player.profileId}
                  className="flex items-center justify-between rounded-lg bg-slate-950/70 px-3 py-2"
                >
                  <span>
                    <span className="block font-semibold">{player.name}</span>
                    <span className="text-xs text-slate-400">
                      Time {player.team} - {player.result === 'W' ? 'Vitoria' : 'Derrota'}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block font-semibold">{player.pointsAfter}</span>
                    <span className={player.pointsDelta >= 0 ? 'text-emerald-300' : 'text-red-300'}>
                      {formatDelta(player.pointsDelta)}
                    </span>
                  </span>
                </div>
              ))}
            </div>

            <button
              className="min-h-[44px] rounded-lg bg-slate-50 px-4 py-3 font-semibold text-slate-950 disabled:opacity-60"
              type="button"
              disabled={undoing || remainingSeconds <= 0}
              onClick={() => {
                void handleUndo();
              }}
            >
              {undoing ? 'Desfazendo...' : `Desfazer (${remainingSeconds}s)`}
            </button>
          </section>
        ) : null}

        {notice ? (
          <p className="rounded-lg border border-emerald-300/40 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-100">
            {notice}
          </p>
        ) : null}

        {profileLoading ? <ScreenSkeleton rows={2} /> : null}

        <form className="grid gap-5" onSubmit={handleSubmit}>
          <PlayerSelector
            selectedPlayers={selectedPlayers}
            disabled={submitting || profileLoading}
            excludePlayerId={currentPlayer?.id}
            maxPlayers={3}
            onChange={setSelectedPlayers}
          />

          {matchPlayers.length > 0 ? (
            <section className="grid gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-slate-100">Times</h2>
                <span className="text-sm text-slate-400">
                  A: {teamCounts.A} - B: {teamCounts.B}
                </span>
              </div>

              <div className="grid gap-2">
                {matchPlayers.map((player, index) => {
                  const activeTeam = teams[player.id] ?? defaultTeamForIndex(index);
                  const isCurrentPlayer = currentPlayer?.id === player.id;

                  return (
                    <div
                      key={player.id}
                      className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg bg-slate-950 px-3 py-2"
                    >
                      <span>
                        <span className="block font-semibold">{player.name}</span>
                        <span className="text-sm text-slate-400">
                          {player.points} pontos{isCurrentPlayer ? ' - voce' : ''}
                        </span>
                      </span>

                      <span className="grid grid-cols-2 gap-1 rounded-lg bg-slate-900 p-1">
                        {(['A', 'B'] as Team[]).map((team) => (
                          <button
                            key={team}
                            className={[
                              'min-h-[36px] rounded-md px-3 text-sm font-semibold',
                              activeTeam === team
                                ? 'bg-emerald-300 text-slate-950'
                                : 'text-slate-300',
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

          <ScoreInput
            teamAScore={teamAScore}
            teamBScore={teamBScore}
            disabled={submitting || profileLoading}
            onTeamAScoreChange={setTeamAScore}
            onTeamBScoreChange={setTeamBScore}
          />

          {error ? <ErrorBanner message={error} /> : null}

          <button
            className="min-h-[44px] rounded-lg bg-emerald-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-60"
            type="submit"
            disabled={submitting || profileLoading}
          >
            {submitting ? 'Salvando...' : 'Salvar partida'}
          </button>
        </form>
      </section>
    </main>
  );
}
