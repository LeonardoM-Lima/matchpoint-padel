// contracts/types.ts (feature 004 — Divisões Dinâmicas do Ranking Global)
//
// Proposta de shape para a renomeação da classe de ranking e o cálculo de divisões.
// Estes tipos SUBSTITUEM o uso de `PlayerLevel` (definido em
// specs/001-matchpoint-mvp/contracts/types.ts) nas telas de ranking, matchmaking
// e perfil. A `PlayerCategory` (categoria declarada) permanece INALTERADA.
//
// Convenção: Divisão 3 = base, Divisão 1 = topo.

// ─── Divisão (substitui PlayerLevel) ─────────────────────────────────────────

/** Classe de ranking derivada da posição relativa entre jogadores ativos. */
export type Division = 'Divisão 1' | 'Divisão 2' | 'Divisão 3';

/**
 * Divisão de um jogador, ou `null` quando não há divisão atribuída:
 *  - jogador inativo (wins + losses === 0), ou
 *  - menos de MIN_ACTIVE_FOR_DIVISIONS jogadores ativos no total.
 */
export type DivisionOrNone = Division | null;

// ─── Constantes da regra ─────────────────────────────────────────────────────

/** Nº mínimo de jogadores ativos para que divisões sejam atribuídas (FR-010). */
export const MIN_ACTIVE_FOR_DIVISIONS = 9;

/** Pontuação inicial do ranking global após a migração (FR-001). */
export const INITIAL_GLOBAL_POINTS = 0;

// ─── Tamanhos das divisões (FR-011, D7) ──────────────────────────────────────

export interface DivisionSizes {
  div1: number; // topo  = floor(n / 3)
  div2: number; // meio  = n - div1 - div3 (recebe a sobra)
  div3: number; // base  = floor(n / 3)
}

/**
 * Calcula os tamanhos das três divisões para `n` jogadores ativos.
 * Retorna null quando n < MIN_ACTIVE_FOR_DIVISIONS (sem divisões).
 *
 * Exemplos:
 *   n=9  -> { div1:3, div2:3, div3:3 }
 *   n=10 -> { div1:3, div2:4, div3:3 }
 *   n=11 -> { div1:3, div2:5, div3:3 }
 */
export function computeDivisionSizes(n: number): DivisionSizes | null {
  if (n < MIN_ACTIVE_FOR_DIVISIONS) return null;
  const third = Math.floor(n / 3);
  return { div1: third, div3: third, div2: n - third - third };
}

// ─── Impacto nos DTOs existentes ──────────────────────────────────────────────
//
// Onde os tipos da 001/002 hoje têm `level: PlayerLevel`, passam a ter
// `division: DivisionOrNone`. A categoria declarada continua separada.
//
// Exemplo de RankingEntry após a migração (referência — o tipo canônico continua
// em specs/001-matchpoint-mvp/contracts/types.ts, que deve ser atualizado):
//
//   export interface RankingEntry extends Omit<ProfileDTO, 'userId' | 'email'> {
//     position: number;
//     totalMatches: number;
//     division: DivisionOrNone;   // <- era `level: PlayerLevel`
//     category?: PlayerCategory | null; // <- INALTERADO (pode ser 'Iniciante')
//     pointDiffToAbove?: number;
//     pointDiffToBelow?: number;
//   }
