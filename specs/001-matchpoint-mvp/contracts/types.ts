// contracts/types.ts
// Domain DTOs and payloads for EvoPadel MVP.
// These types are shared between frontend (React) and tests,
// and serve as the source of truth for data shape across layers.

export type PlayerLevel = 'Iniciante' | 'Amador' | 'Avançado';
export type PlayerCategory = '1a' | '2a' | '3a' | '4a' | '5a' | '6a' | 'Open' | 'Iniciante';

export type Team = 'A' | 'B';

export type MatchResult = 'W' | 'L';

// ─── Profile ────────────────────────────────────────────────────────────────

/** Perfil público de um jogador conforme retornado pelo banco. */
export interface ProfileDTO {
  id: string;
  userId: string;
  name: string;      // nickname (exibição pública)
  email?: string;
  avatarUrl?: string | null;
  category?: PlayerCategory | null;
  points: number;    // pontuação atual (≥ 0)
  wins: number;
  losses: number;
  level: PlayerLevel; // derivado de points, não armazenado
  createdAt: string;
  updatedAt: string;
}

// ─── Ranking ─────────────────────────────────────────────────────────────────

/** Entrada do ranking global, incluindo posição e delta para vizinhos. */
export interface RankingEntry extends Omit<ProfileDTO, 'userId' | 'email'> {
  position: number;
  totalMatches: number;
  pointDiffToAbove?: number; // diferença para o jogador imediatamente acima
  pointDiffToBelow?: number; // diferença para o jogador imediatamente abaixo
}

// ─── Matchmaking ─────────────────────────────────────────────────────────────

/** Card exibido na tela de matchmaking (US3). */
export interface MatchmakingSuggestion {
  id: string;
  name: string;
  avatarUrl?: string | null;
  category?: PlayerCategory | null;
  points: number;
  level: PlayerLevel;
  position: number;
  pointDiff: number;    // |current_user_points − suggestion_points|
  gamesTogether: number; // partidas jogadas juntos (0 = nunca jogaram)
}

// ─── Match ───────────────────────────────────────────────────────────────────

/** Placar de um único set. */
export interface SetScore {
  teamA: number;
  teamB: number;
}

/** Participação de um jogador em uma partida, com histórico de pontuação. */
export interface MatchPlayerRecord {
  id: string;
  matchId: string;
  profileId: string;
  team: Team;
  result: MatchResult;
  pointsBefore: number;  // pontuação imediatamente antes da partida
  pointsDelta: number;   // variação aplicada (positivo ou negativo)
  pointsAfter: number;   // pontuação resultante (≥ 0)
}

/** Registro completo de uma partida com seus jogadores. */
export interface MatchRecord {
  id: string;
  createdBy: string;   // profile_id do criador
  teamAScore: number;  // games do time A (1 set único no MVP)
  teamBScore: number;  // games do time B
  winnerTeam: Team;    // derivado server-side; nunca enviado pelo cliente
  playedAt: string;    // gerado pelo servidor via DEFAULT now()
  createdAt: string;
  players: MatchPlayerRecord[];
}

// ─── Payloads ────────────────────────────────────────────────────────────────

/** Payload enviado pelo frontend para registrar uma partida (US1).
 *  O cliente envia apenas os scores e os jogadores.
 *  winner_team e played_at são derivados/gerados server-side (FR-005d, CHK018).
 */
export interface RegisterMatchPayload {
  teamAScore: number;
  teamBScore: number;
  players: Array<{
    profileId: string;
    team: Team;
  }>;
}
