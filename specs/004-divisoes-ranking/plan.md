# Implementation Plan: Divisões Dinâmicas do Ranking Global

**Branch**: `004-divisoes-ranking` | **Date**: 2026-05-29 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/004-divisoes-ranking/spec.md`

## Summary

Três mudanças coordenadas no ranking global:

1. **Pontos iniciais 0**: `profiles.points` passa de `default 1000` para `default 0`
   (migração SQL). Elo e histórico inalterados — só o ponto de partida muda.
2. **Renomear a classe de ranking**: o tipo derivado deixa de ser
   `Iniciante | Amador | Avançado` e passa a ser `Divisão 3 | Divisão 2 | Divisão 1`,
   eliminando o choque com a **categoria** declarada (que mantém "Iniciante").
3. **Divisão por terços dinâmicos**: a função que hoje classifica por faixa fixa de
   pontos (`getLevel`, com `800/1300`) é substituída por um cálculo de posição
   relativa entre **jogadores ativos** (`wins+losses ≥ 1`), distribuído em terços,
   só quando há **≥ 9 ativos**.

Tudo permanece **derivado em tempo de leitura** — nada de divisão é persistido,
seguindo o padrão atual do `level`.

## Pontos de Mudança no Código

### 1. Migração SQL — pontos iniciais

Nova migração (próximo número disponível na pasta `supabase/migrations/`), por exemplo
`0XX_profiles_points_default_zero.sql`:

```sql
-- altera o default para novos perfis
alter table profiles alter column points set default 0;
-- reset total dos perfis existentes (OQ-1 = B, decidido 2026-05-29)
update profiles set points = 0, wins = 0, losses = 0;
-- constraint points >= 0 já existe (001_create_profiles.sql) — manter.
```

> **OQ-1 (DECIDIDO: opção B)**: todos os perfis existentes têm `points`, `wins` e
> `losses` zerados na migração. Histórico de partidas (`match_players`) permanece.
> Pós-deploy, ninguém é ativo até registrar novas partidas — divisões só reaparecem
> com ≥9 ativos. Detalhes em [data-model.md](./data-model.md).

### 2. `src/services/ranking.service.ts` — substituir `getLevel`

Hoje (`ranking.service.ts:38-42`):

```ts
function getLevel(points: number): PlayerLevel {
  if (points < 800) return 'Iniciante';
  if (points < 1300) return 'Amador';
  return 'Avançado';
}
```

Passa a ser um cálculo **por posição**, aplicado ao conjunto ordenado em
`buildRankingEntries` (não por linha isolada). Esboço:

```ts
const MIN_ACTIVE_FOR_DIVISIONS = 9;

function isActive(row: ProfileRankingRow): boolean {
  return row.wins + row.losses >= 1;
}

// Recebe as linhas JÁ ordenadas pelo comparador do ranking.
// Retorna um Map<profileId, Division | null>.
function assignDivisions(sortedRows: ProfileRankingRow[]): Map<string, Division | null> {
  const result = new Map<string, Division | null>();
  const active = sortedRows.filter(isActive); // mantém a ordem do ranking
  const n = active.length;

  if (n < MIN_ACTIVE_FOR_DIVISIONS) {
    for (const row of sortedRows) result.set(row.id, null);
    return result;
  }

  const sizeTop = Math.floor(n / 3);          // Divisão 1
  const sizeBottom = Math.floor(n / 3);       // Divisão 3
  const sizeMiddle = n - sizeTop - sizeBottom; // Divisão 2 recebe a sobra (FR-011)

  active.forEach((row, i) => {
    if (i < sizeTop) result.set(row.id, 'Divisão 1');
    else if (i < sizeTop + sizeMiddle) result.set(row.id, 'Divisão 2');
    else result.set(row.id, 'Divisão 3');
  });

  // inativos ficam sem divisão (FR-009)
  for (const row of sortedRows) {
    if (!result.has(row.id)) result.set(row.id, null);
  }
  return result;
}
```

**Fronteira / empate (FR-013)**: como a divisão é atribuída pela **posição na ordem
de desempate** (`points DESC, wins DESC, losses ASC, name`), um empate puro de pontos
já resolve a favor de quem está acima nessa ordem; quem fica logo abaixo da fronteira
cai na divisão inferior naturalmente. Sem regra extra além de respeitar o índice.

`buildRankingEntries` passa a chamar `assignDivisions(sortedRows)` uma vez e usar o
Map para preencher o campo de cada entrada (substituindo `level: getLevel(...)`).

### 3. Tipos — `specs/001-matchpoint-mvp/contracts/types.ts`

O `PlayerLevel` está definido na 001 e reusado em várias telas. Estratégia:

- Introduzir `Division = 'Divisão 1' | 'Divisão 2' | 'Divisão 3'`.
- Onde hoje há `level: PlayerLevel`, passar a `division: Division | null`
  (`null` = sem divisão). Ver [contracts/types.ts](./contracts/types.ts) desta feature
  para o shape proposto.
- **Não** remover `PlayerLevel` da 001 silenciosamente se algo ainda depender —
  fazer a troca de uso e só então remover. Verificar todos os 23 arquivos que
  referenciam os termos antigos (grep em `Iniciante|Amador|Avançado|level`).

### 4. Componentes de UI que exibem o nível

Trocar o rótulo e a fonte do dado (`level` → `division`), tratando `null`
(sem badge):

- `src/components/RankingRow.tsx`
- `src/components/PlayerCard.tsx`
- `src/components/MatchmakingCard.tsx`
- `src/screens/ProfileScreen.tsx`
- `src/screens/PlayerProfileScreen.tsx`
- `src/screens/HomeScreen.tsx`
- (conferir `CategoryBadge.tsx` — esse é **categoria**, NÃO mexer no vocabulário dela)

> Atenção: separar visualmente badge de **divisão** (derivada) de badge de
> **categoria** (declarada). São dois conceitos.

### 5. Matchmaking — `src/services/matchmaking.service.ts`

`buildMatchmakingSuggestions` consome `entry.level`. Trocar para `entry.division`.
O matchmaking não depende da semântica do rótulo (só exibe), então a mudança é direta.

## Testing Strategy

Arquivos de teste que referenciam os termos antigos (atualizar):

- `tests/integration/ranking.test.ts`
- `tests/integration/elo.test.ts`
- `tests/integration/matchmaking.test.ts`
- `tests/integration/match.test.ts`
- `tests/integration/auth.test.ts` (pode assumir 1000 inicial — revisar)

Novos casos unitários para `assignDivisions`:

- n = 8 → todos `null` (sem divisões). (FR-010)
- n = 9 → 3/3/3. (FR-011, SC-002)
- n = 10 → Div1=3, Div2=4, Div3=3. (FR-011)
- n = 11 → Div1=3, Div2=5, Div3=3.
- Mistura de ativos e inativos → inativos `null` e fora da contagem `n`. (FR-009)
- Empate de pontos na fronteira → quem está abaixo na ordem fica na divisão inferior. (FR-013)
- Troca de posição recalcula divisão. (FR-014, SC-004)

## Migration / Rollout Notes

- A troca de `default` não afeta linhas existentes — só novos `INSERT` sem `points`.
- OQ-1 decidido (opção B): o `UPDATE` zera todos os perfis existentes. No dia 1 o
  ranking aparece sem divisões (todos inativos) até registrarem novas partidas.
- Como divisão é derivada, não há backfill: ao subir o código novo, o ranking já
  exibe divisões no próximo carregamento.

## Constitution Check

- **Simplicidade**: nenhum novo serviço/infra; só uma migração + lógica derivada no
  serviço de ranking existente. ✅
- **Fonte única de verdade**: tipos centralizados em `contracts/types.ts`. ✅
- **Sem persistência redundante**: divisão continua derivada, como o nível atual. ✅
