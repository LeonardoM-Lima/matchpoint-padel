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
  avatar_url?: string | null;
  category?: RankingEntry['category'];
  points: number;
  wins: number;
  losses: number;
  created_at: string;
  updated_at: string;
}

interface MatchmakingAvailabilityRow {
  profile_id: string;
  whatsapp_number: string;
  available_until: string;
}

const categoryOrder: Array<RankingEntry['category']> = [
  '1a',
  '2a',
  '3a',
  '4a',
  '5a',
  '6a',
  'Open',
  'Iniciante',
];

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

function getCategorySortValue(category?: RankingEntry['category'] | null) {
  const index = categoryOrder.indexOf(category as RankingEntry['category']);
  return index === -1 ? categoryOrder.length : index;
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
      avatarUrl: row.avatar_url,
      category: row.category,
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
  availabilityByProfileId: Map<string, MatchmakingAvailabilityRow> = new Map(),
  myMatchIds: Set<string> = new Set(),
  candidateMatchIds: Map<string, Set<string>> = new Map(),
): MatchmakingSuggestion[] {
  return buildRankingEntries(rows)
    .filter((entry) => {
      if (entry.id === currentProfileId) return false;
      return availabilityByProfileId.has(entry.id);
    })
    .map((entry) => {
      const availability = availabilityByProfileId.get(entry.id)!;
      const theirMatchIds = candidateMatchIds.get(entry.id) ?? new Set<string>();
      let gamesTogether = 0;
      for (const id of theirMatchIds) {
        if (myMatchIds.has(id)) gamesTogether++;
      }
      return {
        id: entry.id,
        name: entry.name,
        avatarUrl: entry.avatarUrl,
        category: entry.category,
        whatsappNumber: availability.whatsapp_number,
        availableUntil: availability.available_until,
        points: entry.points,
        level: entry.level,
        position: entry.position,
        pointDiff: Math.abs(entry.points - currentUserPoints),
        gamesTogether,
      };
    })
    .sort((a, b) => {
      const categoryDiff = getCategorySortValue(a.category) - getCategorySortValue(b.category);
      if (categoryDiff !== 0) return categoryDiff;
      if (a.position !== b.position) return a.position - b.position;
      return a.name.localeCompare(b.name);
    });
}

export const rankingService = {
  async getRanking(): Promise<RankingEntry[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('id,name,avatar_url,category,points,wins,losses,created_at,updated_at')
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
      .select('id,user_id,name,avatar_url,category,points,wins,losses,created_at,updated_at')
      .order('points', { ascending: false })
      .order('wins', { ascending: false })
      .order('losses', { ascending: true });

    if (error) throw error;

    const rows = (data ?? []) as ProfileRankingRow[];
    const currentProfile = rows.find((row) => row.user_id === user.id);

    if (!currentProfile) return [];

    const { data: availabilityData, error: availabilityError } = await supabase
      .from('matchmaking_availability')
      .select('profile_id,whatsapp_number,available_until')
      .gt('available_until', new Date().toISOString());

    if (availabilityError) throw availabilityError;

    const availabilityRows = (availabilityData ?? []) as MatchmakingAvailabilityRow[];
    const availabilityByProfileId = new Map(
      availabilityRows.map((row) => [row.profile_id, row]),
    );

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
      availabilityByProfileId,
      myMatchIds,
      candidateMatchIds,
    );
  },
};
