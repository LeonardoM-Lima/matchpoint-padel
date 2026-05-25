import type { RegisterMatchPayload, Team } from '../../specs/001-matchpoint-mvp/contracts/types';
import type { RegisterMatchPayloadV2 } from '../../specs/002-perfil-e-ligas/contracts/types';
import { toRegisterMatchRPCV2 } from '../../specs/002-perfil-e-ligas/contracts/rpc';
import { supabase } from '../lib/supabase';

export interface MatchHistoryEntry {
  matchId: string;
  playedAt: string;
  teamAScore: number;
  teamBScore: number;
  winnerTeam: Team;
  userTeam: Team;
  result: 'W' | 'L';
  pointsBefore: number;
  pointsDelta: number;
  pointsAfter: number;
  partnerName: string;
  opponent1Name: string;
  opponent2Name: string;
  leagueName?: string;
}

export interface RegisteredMatchPlayer {
  profileId: string;
  name: string;
  team: Team;
  result: 'W' | 'L';
  pointsBefore: number;
  pointsDelta: number;
  pointsAfter: number;
}

export interface RegisteredMatch {
  matchId: string;
  players: RegisteredMatchPlayer[];
}

interface MatchPlayerSummaryRow {
  profile_id: string;
  team: Team;
  result: 'W' | 'L';
  points_before: number;
  points_delta: number;
  points_after: number;
  profiles: {
    name: string;
  } | null;
}

function mapMatchPlayer(row: MatchPlayerSummaryRow): RegisteredMatchPlayer {
  return {
    profileId: row.profile_id,
    name: row.profiles?.name ?? 'Jogador',
    team: row.team,
    result: row.result,
    pointsBefore: row.points_before,
    pointsDelta: row.points_delta,
    pointsAfter: row.points_after,
  };
}

async function getMatchSummary(matchId: string): Promise<RegisteredMatch> {
  const { data, error } = await supabase
    .from('match_players')
    .select('profile_id,team,result,points_before,points_delta,points_after,profiles(name)')
    .eq('match_id', matchId)
    .order('team', { ascending: true });

  if (error) throw error;

  return {
    matchId,
    players: (data as unknown as MatchPlayerSummaryRow[]).map(mapMatchPlayer),
  };
}

interface MatchPlayerRow {
  match_id: string;
  team: Team;
  result: 'W' | 'L';
  points_before: number;
  points_delta: number;
  points_after: number;
  profiles: { name: string } | null;
  matches: {
    played_at: string;
    team_a_score: number;
    team_b_score: number;
    winner_team: Team;
    match_players: { team: Team; profile_id: string; profiles: { name: string } | null }[];
    match_leagues: { leagues: { name: string } | null }[];
  } | null;
}

async function getMatchHistory(userId: string): Promise<MatchHistoryEntry[]> {
  const { data, error } = await supabase
    .from('match_players')
    .select(
      'match_id,team,result,points_before,points_delta,points_after,profiles(name),matches(played_at,team_a_score,team_b_score,winner_team,match_players(team,profile_id,profiles(name)),match_leagues(leagues(name)))',
    )
    .eq('profile_id', userId)
    .order('match_id', { ascending: false });

  if (error) throw error;

  return (data as unknown as MatchPlayerRow[])
    .map((row) => {
      const match = row.matches!;
      const allPlayers = match.match_players;
      const partner = allPlayers.find((p) => p.team === row.team && p.profile_id !== userId);
      const opponents = allPlayers.filter((p) => p.team !== row.team);

      return {
        matchId: row.match_id,
        playedAt: match.played_at,
        teamAScore: match.team_a_score,
        teamBScore: match.team_b_score,
        winnerTeam: match.winner_team,
        userTeam: row.team,
        result: row.result,
        pointsBefore: row.points_before,
        pointsDelta: row.points_delta,
        pointsAfter: row.points_after,
        partnerName: partner?.profiles?.name ?? 'Parceiro',
        opponent1Name: opponents[0]?.profiles?.name ?? 'Adversário',
        opponent2Name: opponents[1]?.profiles?.name ?? 'Adversário',
        leagueName: match.match_leagues?.[0]?.leagues?.name ?? undefined,
      };
    })
    .sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime());
}

export const matchService = {
  async registerMatch(payload: RegisterMatchPayload | RegisterMatchPayloadV2): Promise<RegisteredMatch> {
    const { data, error } = await supabase.rpc('register_match', {
      payload: toRegisterMatchRPCV2(payload),
    });

    if (error) throw error;
    if (!data) throw new Error('register_match did not return a match id.');

    return getMatchSummary(data as string);
  },

  getMatchHistory,

  async deleteMatch(matchId: string): Promise<void> {
    const { error } = await supabase.rpc('delete_match', {
      p_match_id: matchId,
    });

    if (error) throw error;
  },
};
