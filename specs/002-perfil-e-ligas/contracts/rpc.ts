// contracts/rpc.ts (002-perfil-e-ligas)
// Type-safe adapters between frontend DTOs (camelCase) and Supabase RPC
// payloads (snake_case). Mantém o domain layer decoupled do wire format.

import type {
  RegisterMatchPayloadV2,
  CreateLeaguePayload,
  UpdateLeaguePayload,
  PlayerCategory,
} from './types';

// ─── register_match v2 ──────────────────────────────────────────────────────

/** Wire format aceito pela RPC `register_match` (v2 com league_id). */
export interface RegisterMatchRPCPayloadV2 {
  team_a_score: number;
  team_b_score: number;
  players: Array<{
    profile_id: string;
    team: 'A' | 'B';
  }>;
  league_id?: string;
}

export function toRegisterMatchRPCV2(
  payload: RegisterMatchPayloadV2,
): RegisterMatchRPCPayloadV2 {
  const rpc: RegisterMatchRPCPayloadV2 = {
    team_a_score: payload.teamAScore,
    team_b_score: payload.teamBScore,
    players: payload.players.map((p) => ({
      profile_id: p.profileId,
      team: p.team,
    })),
  };
  if (payload.leagueId) rpc.league_id = payload.leagueId;
  return rpc;
}

// ─── create_league ──────────────────────────────────────────────────────────

export interface CreateLeagueRPCParams {
  p_name: string;
  p_cover_url?: string;
}

export function toCreateLeagueRPC(payload: CreateLeaguePayload): CreateLeagueRPCParams {
  const params: CreateLeagueRPCParams = { p_name: payload.name };
  if (payload.coverUrl) params.p_cover_url = payload.coverUrl;
  return params;
}

// ─── update_league ──────────────────────────────────────────────────────────

export interface UpdateLeagueRPCParams {
  p_league_id: string;
  p_name?: string;
  p_cover_url?: string;
}

export function toUpdateLeagueRPC(
  leagueId: string,
  payload: UpdateLeaguePayload,
): UpdateLeagueRPCParams {
  const params: UpdateLeagueRPCParams = { p_league_id: leagueId };
  if (payload.name !== undefined) params.p_name = payload.name;
  if (payload.coverUrl !== undefined) params.p_cover_url = payload.coverUrl;
  return params;
}

// ─── add_league_member / remove_league_member / delete_league ──────────────

export interface LeagueMemberRPCParams {
  p_league_id: string;
  p_profile_id: string;
}

export interface DeleteLeagueRPCParams {
  p_league_id: string;
}

// ─── get_eligible_leagues_for_match ─────────────────────────────────────────

export interface EligibleLeaguesRPCParams {
  p_player_ids: string[];
}

// ─── update_profile (regular UPDATE — não é RPC) ───────────────────────────

/** Wire format para `UPDATE profiles SET ...`. */
export interface UpdateProfileRow {
  name?: string;
  avatar_url?: string | null;
  category?: PlayerCategory | null;
}
