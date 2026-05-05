import type { RegisterMatchPayload, Team } from '../../specs/001-matchpoint-mvp/contracts/types';
import { toRegisterMatchRPC } from '../../specs/001-matchpoint-mvp/contracts/rpc';
import { supabase } from '../lib/supabase';

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

export const matchService = {
  async registerMatch(payload: RegisterMatchPayload): Promise<RegisteredMatch> {
    const { data, error } = await supabase.rpc('register_match', {
      payload: toRegisterMatchRPC(payload),
    });

    if (error) throw error;
    if (!data) throw new Error('register_match did not return a match id.');

    return getMatchSummary(data as string);
  },

  async deleteMatch(matchId: string): Promise<void> {
    const { error } = await supabase.rpc('delete_match', {
      p_match_id: matchId,
    });

    if (error) throw error;
  },
};
