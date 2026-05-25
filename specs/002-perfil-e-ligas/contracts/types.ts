// contracts/types.ts (002-perfil-e-ligas)
// Domain DTOs and payloads for Perfil + Ligas Privadas.
// These types are shared between frontend (React) and tests.
// Re-exports relevant MVP types where applicable.

import type { PlayerLevel } from '../../001-matchpoint-mvp/contracts/types';

// ─── Profile (estendido) ────────────────────────────────────────────────────

/** Categoria informativa auto-declarada pelo jogador (FR-006). */
export type PlayerCategory =
  | '1a' | '2a' | '3a' | '4a' | '5a' | '6a'
  | 'Open' | 'Iniciante';

/** Perfil estendido com avatar e categoria. */
export interface ProfileDTO {
  id: string;
  userId: string;
  name: string;
  email?: string;
  avatarUrl?: string;       // path relativo no bucket `avatars` (gera URL via client)
  category?: PlayerCategory; // categoria informativa (cosmética)
  points: number;
  wins: number;
  losses: number;
  level: PlayerLevel;
  createdAt: string;
  updatedAt: string;
}

/** Payload para atualizar perfil (FR-001). Todos os campos opcionais —
 *  apenas os campos enviados são atualizados. */
export interface UpdateProfilePayload {
  name?: string;
  avatarUrl?: string;
  category?: PlayerCategory | null; // null permite limpar a categoria
}

// ─── League ──────────────────────────────────────────────────────────────────

/** Liga privada conforme retornada pelo banco. */
export interface LeagueDTO {
  id: string;
  ownerId: string;       // profile_id do dono
  name: string;
  coverUrl?: string;     // path relativo no bucket `league-covers`
  memberCount: number;   // calculado server-side
  isOwner: boolean;      // calculado em relação ao usuário atual
  createdAt: string;
  updatedAt: string;
}

/** Payload para criar liga (FR-010). */
export interface CreateLeaguePayload {
  name: string;
  coverUrl?: string;
}

/** Payload para atualizar metadados da liga (apenas dono). */
export interface UpdateLeaguePayload {
  name?: string;
  coverUrl?: string;
}

// ─── League membership ──────────────────────────────────────────────────────

/** Entrada do ranking interno da liga. */
export interface LeagueRankingEntry {
  profileId: string;
  name: string;
  avatarUrl?: string;
  category?: PlayerCategory;
  points: number;        // pontos NA LIGA (não global)
  wins: number;
  losses: number;
  level: PlayerLevel;    // derivado dos pontos da liga
  position: number;
  isCurrentUser: boolean;
}

/** Participação de jogador em uma liga (para listagens administrativas). */
export interface LeaguePlayerDTO {
  id: string;
  leagueId: string;
  profileId: string;
  points: number;
  wins: number;
  losses: number;
  joinedAt: string;
}

/** Visão composta usada pela `LeagueDetailScreen`: liga + ranking + permissões
 *  do usuário atual, calculadas em um único hook (`useLeague`). */
export interface LeagueDetailDTO {
  league: LeagueDTO;
  ranking: LeagueRankingEntry[];
  permissions: {
    isOwner: boolean;
    isMember: boolean;
    canAddMember: boolean;     // = isOwner
    canEdit: boolean;          // = isOwner
    canDelete: boolean;        // = isOwner
    canLeave: boolean;         // = isMember && !isOwner
  };
}

// ─── Match-League integration ───────────────────────────────────────────────

/** Liga elegível para vincular a uma partida em registro
 *  (todos os 4 jogadores selecionados são participantes). */
export interface EligibleLeague {
  id: string;
  name: string;
  coverUrl?: string;
}

/** Histórico de pontuação na dimensão liga, espelhando MatchPlayerRecord. */
export interface MatchLeaguePlayerRecord {
  id: string;
  matchId: string;
  leagueId: string;
  profileId: string;
  leaguePointsBefore: number;
  leaguePointsDelta: number;
  leaguePointsAfter: number;
}

// ─── Payloads de registro de partida (v2 — com league_id opcional) ──────────

/** Payload v2 do RegisterMatch incluindo vínculo opcional com liga. */
export interface RegisterMatchPayloadV2 {
  teamAScore: number;
  teamBScore: number;
  players: Array<{
    profileId: string;
    team: 'A' | 'B';
  }>;
  leagueId?: string; // vínculo opcional (FR-020)
}

// ─── Upload helpers ────────────────────────────────────────────────────────

/** Limites de upload de imagem (FR-004). */
export const IMAGE_UPLOAD_LIMITS = {
  maxBytes: 2 * 1024 * 1024,
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'] as const,
} as const;

export type AllowedImageMimeType = (typeof IMAGE_UPLOAD_LIMITS.allowedMimeTypes)[number];
