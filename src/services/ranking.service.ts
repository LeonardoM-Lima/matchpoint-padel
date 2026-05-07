import type {
  MatchmakingSuggestion,
  PlayerLevel,
  RankingEntry,
} from '../../specs/001-matchpoint-mvp/contracts/types';
import { supabase } from '../lib/supabase';

interface ProfileRankingRow {
  id: string;
  user_id?: string;
  name: string;
  points: number;
  wins: number;
  losses: number;
  created_at: string;
  updated_at: string;
}

function getLevel(points: number): PlayerLevel {
  if (points < 800) return 'Iniciante';
  if (points < 1300) return 'Amador';
  return 'Avançado';
}

function compareRankingRows(a: ProfileRankingRow, b: ProfileRankingRow) {
  if (b.points !== a.points) return b.points - a.points;
  if (b.wins !== a.wins) return b.wins - a.wins;
  if (a.losses !== b.losses) return a.losses - b.losses;
  return a.name.localeCompare(b.name);
}

function hasSameRank(a: ProfileRankingRow, b: ProfileRankingRow) {
  return a.points === b.points && a.wins === b.wins && a.losses === b.losses;
}

export function buildRankingEntries(rows: ProfileRankingRow[]): RankingEntry[] {
  const sortedRows = [...rows].sort(compareRankingRows);
  let lastRankedRow: ProfileRankingRow | null = null;
  let currentPosition = 0;

  return sortedRows.map((row, index) => {
    const above = sortedRows[index - 1];
    const below = sortedRows[index + 1];

    if (!lastRankedRow || !hasSameRank(row, lastRankedRow)) {
      currentPosition = index + 1;
      lastRankedRow = row;
    }

    return {
      id: row.id,
      name: row.name,
      points: row.points,
      wins: row.wins,
      losses: row.losses,
      level: getLevel(row.points),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      totalMatches: row.wins + row.losses,
      position: currentPosition,
      pointDiffToAbove: above ? above.points - row.points : undefined,
      pointDiffToBelow: below ? row.points - below.points : undefined,
    };
  });
}

export function buildMatchmakingSuggestions(
  rows: ProfileRankingRow[],
  currentProfileId: string,
  currentUserPoints: number,
  myMatchIds: Set<string>,
  candidateMatchIds: Map<string, Set<string>>,
): MatchmakingSuggestion[] {
  return buildRankingEntries(rows)
    .filter((entry) => entry.id !== currentProfileId)
    .map((entry) => {
      const theirMatchIds = candidateMatchIds.get(entry.id) ?? new Set<string>();
      let gamesTogether = 0;
      for (const id of theirMatchIds) {
        if (myMatchIds.has(id)) gamesTogether++;
      }
      return {
        id: entry.id,
        name: entry.name,
        points: entry.points,
        level: entry.level,
        position: entry.position,
        pointDiff: Math.abs(entry.points - currentUserPoints),
        gamesTogether,
      };
    })
    .sort((a, b) => {
      if (a.pointDiff !== b.pointDiff) return a.pointDiff - b.pointDiff;
      if (b.points !== a.points) return b.points - a.points;
      return a.name.localeCompare(b.name);
    });
}

export const rankingService = {
  async getRanking(): Promise<RankingEntry[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('id,name,points,wins,losses,created_at,updated_at')
      .order('points', { ascending: false })
      .order('wins', { ascending: false })
      .order('losses', { ascending: true });

    if (error) throw error;
    return buildRankingEntries((data ?? []) as ProfileRankingRow[]);
  },

  async getMatchmakingSuggestions(currentUserPoints: number): Promise<MatchmakingSuggestion[]> {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;
    if (!user) throw new Error('Authenticated user is required for matchmaking.');

    const { data, error } = await supabase
      .from('profiles')
      .select('id,user_id,name,points,wins,losses,created_at,updated_at')
      .order('points', { ascending: false })
      .order('wins', { ascending: false })
      .order('losses', { ascending: true });

    if (error) throw error;

    const rows = (data ?? []) as ProfileRankingRow[];
    const currentProfile = rows.find((row) => row.user_id === user.id);

    if (!currentProfile) return [];

    // Buscar todos os match_ids do usuário atual para calcular games_together
    const { data: myMatchData, error: myMatchError } = await supabase
      .from('match_players')
      .select('match_id,profile_id')
      .in('profile_id', [currentProfile.id, ...rows.filter(r => r.user_id !== user.id).map(r => r.id)]);

    if (myMatchError) throw myMatchError;

    const allMatchRows = (myMatchData ?? []) as { match_id: string; profile_id: string }[];

    const myMatchIds = new Set<string>(
      allMatchRows.filter((r) => r.profile_id === currentProfile.id).map((r) => r.match_id),
    );

    const candidateMatchIds = new Map<string, Set<string>>();
    for (const row of allMatchRows) {
      if (row.profile_id === currentProfile.id) continue;
      if (!candidateMatchIds.has(row.profile_id)) {
        candidateMatchIds.set(row.profile_id, new Set());
      }
      candidateMatchIds.get(row.profile_id)!.add(row.match_id);
    }

    return buildMatchmakingSuggestions(
      rows,
      currentProfile.id,
      currentUserPoints,
      myMatchIds,
      candidateMatchIds,
    );
  },
};
