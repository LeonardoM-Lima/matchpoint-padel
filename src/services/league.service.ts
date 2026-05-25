import type {
  CreateLeaguePayload,
  EligibleLeague,
  LeagueDTO,
  LeagueDetailDTO,
  LeagueRankingEntry,
  PlayerCategory,
  UpdateLeaguePayload,
} from '../../specs/002-perfil-e-ligas/contracts/types';
import {
  toCreateLeagueRPC,
  toUpdateLeagueRPC,
} from '../../specs/002-perfil-e-ligas/contracts/rpc';
import { supabase } from '../lib/supabase';
import { profileService } from './profile.service';

interface LeagueRow {
  id: string;
  owner_id: string;
  name: string;
  cover_url: string | null;
  created_at: string;
  updated_at: string;
}

interface LeaguePlayerRow {
  profile_id: string;
  points: number;
  wins: number;
  losses: number;
  profiles: {
    name: string;
    avatar_url: string | null;
    category: PlayerCategory | null;
  } | null;
}

export interface ProfileSearchResult {
  id: string;
  name: string;
  avatarUrl?: string | null;
  category?: PlayerCategory | null;
  points: number;
  wins: number;
  losses: number;
}

export interface LeagueMatchHistoryEntry {
  matchId: string;
  playedAt: string;
  teamAScore: number;
  teamBScore: number;
  winnerTeam: 'A' | 'B';
  teamAPlayers: string[];
  teamBPlayers: string[];
}

function getLevel(points: number) {
  if (points < 800) return 'Iniciante' as const;
  if (points < 1300) return 'Amador' as const;
  return 'Avançado' as const;
}

async function getCurrentProfileId() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error('Authenticated user is required.');

  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (error) throw error;
  return (data as { id: string }).id;
}

async function getMemberCounts(leagueIds: string[]) {
  if (leagueIds.length === 0) return new Map<string, number>();

  const { data, error } = await supabase
    .from('league_players')
    .select('league_id')
    .in('league_id', leagueIds);

  if (error) throw error;

  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { league_id: string }[]) {
    counts.set(row.league_id, (counts.get(row.league_id) ?? 0) + 1);
  }
  return counts;
}

function mapLeague(row: LeagueRow, currentProfileId: string, memberCount: number): LeagueDTO {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    coverUrl: row.cover_url ?? undefined,
    memberCount,
    isOwner: row.owner_id === currentProfileId,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function coverExtension(file: File) {
  if (file.type === 'image/jpeg') return 'jpg';
  if (file.type === 'image/png') return 'png';
  return 'webp';
}

function uniqueCoverPath(leagueId: string, file: File) {
  return `${leagueId}/cover-${Date.now()}.${coverExtension(file)}`;
}

export const leagueService = {
  async createLeague(payload: CreateLeaguePayload) {
    const { data, error } = await supabase.rpc('create_league', toCreateLeagueRPC(payload));
    if (error) throw error;
    return data as string;
  },

  async updateLeague(leagueId: string, payload: UpdateLeaguePayload) {
    const { error } = await supabase.rpc('update_league', toUpdateLeagueRPC(leagueId, payload));
    if (error) throw error;
  },

  async deleteLeague(leagueId: string) {
    const { error } = await supabase.rpc('delete_league', { p_league_id: leagueId });
    if (error) throw error;
  },

  async addMember(leagueId: string, profileId: string) {
    const { error } = await supabase.rpc('add_league_member', {
      p_league_id: leagueId,
      p_profile_id: profileId,
    });
    if (error) throw error;
  },

  async removeMember(leagueId: string, profileId: string) {
    const { error } = await supabase.rpc('remove_league_member', {
      p_league_id: leagueId,
      p_profile_id: profileId,
    });
    if (error) throw error;
  },

  async getMyLeagues(): Promise<LeagueDTO[]> {
    const currentProfileId = await getCurrentProfileId();
    const { data: memberships, error: membershipError } = await supabase
      .from('league_players')
      .select('league_id')
      .eq('profile_id', currentProfileId);

    if (membershipError) throw membershipError;

    const leagueIds = [
      ...new Set(((memberships ?? []) as { league_id: string }[]).map((row) => row.league_id)),
    ];
    if (leagueIds.length === 0) return [];

    const { data, error } = await supabase
      .from('leagues')
      .select('id,owner_id,name,cover_url,created_at,updated_at')
      .in('id', leagueIds)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const counts = await getMemberCounts(leagueIds);
    return ((data ?? []) as LeagueRow[]).map((row) =>
      mapLeague(row, currentProfileId, counts.get(row.id) ?? 0),
    );
  },

  async getLeague(leagueId: string): Promise<LeagueDetailDTO> {
    const currentProfileId = await getCurrentProfileId();

    const { data: leagueData, error: leagueError } = await supabase
      .from('leagues')
      .select('id,owner_id,name,cover_url,created_at,updated_at')
      .eq('id', leagueId)
      .single();

    if (leagueError) throw leagueError;

    const { data: rankingData, error: rankingError } = await supabase
      .from('league_players')
      .select('profile_id,points,wins,losses,profiles(name,avatar_url,category)')
      .eq('league_id', leagueId)
      .order('points', { ascending: false })
      .order('wins', { ascending: false })
      .order('losses', { ascending: true });

    if (rankingError) throw rankingError;

    const rows = (rankingData ?? []) as unknown as LeaguePlayerRow[];
    let position = 0;
    let last: LeaguePlayerRow | null = null;
    const ranking: LeagueRankingEntry[] = rows.map((row, index) => {
      if (!last || row.points !== last.points || row.wins !== last.wins || row.losses !== last.losses) {
        position = index + 1;
        last = row;
      }

      return {
        profileId: row.profile_id,
        name: row.profiles?.name ?? 'Jogador',
        avatarUrl: row.profiles?.avatar_url ?? undefined,
        category: row.profiles?.category ?? undefined,
        points: row.points,
        wins: row.wins,
        losses: row.losses,
        level: getLevel(row.points),
        position,
        isCurrentUser: row.profile_id === currentProfileId,
      };
    });

    const league = mapLeague(leagueData as LeagueRow, currentProfileId, ranking.length);
    const isMember = ranking.some((entry) => entry.profileId === currentProfileId);

    return {
      league,
      ranking,
      permissions: {
        isOwner: league.isOwner,
        isMember,
        canAddMember: league.isOwner,
        canEdit: league.isOwner,
        canDelete: league.isOwner,
        canLeave: isMember && !league.isOwner,
      },
    };
  },

  async searchProfiles(query: string): Promise<ProfileSearchResult[]> {
    const trimmed = query.trim();

    const { data, error } = await supabase
      .from('profiles')
      .select('id,name,avatar_url,category,points,wins,losses')
      .ilike('name', `%${trimmed}%`)
      .order('name', { ascending: true })
      .limit(trimmed ? 20 : 100);

    if (error) throw error;

    return ((data ?? []) as Array<{
      id: string;
      name: string;
      avatar_url: string | null;
      category: PlayerCategory | null;
      points: number;
      wins: number;
      losses: number;
    }>).map((row) => ({
      id: row.id,
      name: row.name,
      avatarUrl: row.avatar_url,
      category: row.category,
      points: row.points,
      wins: row.wins,
      losses: row.losses,
    }));
  },

  async uploadCover(leagueId: string, file: File) {
    profileService.validateImage(file);
    const path = uniqueCoverPath(leagueId, file);
    const { error } = await supabase.storage
      .from('league-covers')
      .upload(path, file, { cacheControl: '3600', contentType: file.type });

    if (error) throw error;
    await this.updateLeague(leagueId, { coverUrl: path });
    return path;
  },

  async getEligibleLeagues(playerIds: string[]): Promise<EligibleLeague[]> {
    if (playerIds.length !== 4 || playerIds.some((id) => !id)) return [];

    const { data, error } = await supabase.rpc('get_eligible_leagues_for_match', {
      p_player_ids: playerIds,
    });

    if (error) throw error;

    return ((data ?? []) as Array<{ id: string; name: string; cover_url: string | null }>).map(
      (row) => ({
        id: row.id,
        name: row.name,
        coverUrl: row.cover_url ?? undefined,
      }),
    );
  },

  async getLeagueMatchHistory(leagueId: string): Promise<LeagueMatchHistoryEntry[]> {
    const { data, error } = await supabase
      .from('match_leagues')
      .select(
        'match_id,matches(played_at,team_a_score,team_b_score,winner_team,match_players(team,profiles(name)))',
      )
      .eq('league_id', leagueId)
      .order('match_id', { ascending: false });

    if (error) throw error;

    return ((data ?? []) as unknown as Array<{
      match_id: string;
      matches: {
        played_at: string;
        team_a_score: number;
        team_b_score: number;
        winner_team: 'A' | 'B';
        match_players: Array<{ team: 'A' | 'B'; profiles: { name: string } | null }>;
      } | null;
    }>).map((row) => ({
      matchId: row.match_id,
      playedAt: row.matches?.played_at ?? '',
      teamAScore: row.matches?.team_a_score ?? 0,
      teamBScore: row.matches?.team_b_score ?? 0,
      winnerTeam: row.matches?.winner_team ?? 'A',
      teamAPlayers:
        row.matches?.match_players
          .filter((player) => player.team === 'A')
          .map((player) => player.profiles?.name ?? 'Jogador') ?? [],
      teamBPlayers:
        row.matches?.match_players
          .filter((player) => player.team === 'B')
          .map((player) => player.profiles?.name ?? 'Jogador') ?? [],
    }));
  },
};
