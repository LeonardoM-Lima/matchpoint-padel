// contracts/rpc.ts
// Type-safe adapter between frontend DTOs (camelCase) and Supabase RPC
// payloads (snake_case). Keeps the domain layer decoupled from the wire format.

import type { RegisterMatchPayload } from './types';

// ─── register_match ──────────────────────────────────────────────────────────

/** Wire format accepted by the `register_match` Supabase RPC.
 *  winner_team and played_at are derived/generated server-side (FR-005d, CHK018).
 */
export interface RegisterMatchRPCPayload {
  team_a_score: number;
  team_b_score: number;
  players: Array<{
    profile_id: string;
    team: 'A' | 'B';
  }>;
}

/** Converts a frontend RegisterMatchPayload to the RPC wire format. */
export function toRegisterMatchRPC(
  payload: RegisterMatchPayload,
): RegisterMatchRPCPayload {
  return {
    team_a_score: payload.teamAScore,
    team_b_score: payload.teamBScore,
    players: payload.players.map((p) => ({
      profile_id: p.profileId,
      team: p.team,
    })),
  };
}

// ─── delete_match ─────────────────────────────────────────────────────────────

/** Wire format accepted by the `delete_match` Supabase RPC. */
export interface DeleteMatchRPCPayload {
  p_match_id: string;
}
