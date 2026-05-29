# Data Model: Divisões Dinâmicas do Ranking Global

**Feature**: `004-divisoes-ranking` | **Spec**: [spec.md](spec.md)

Esta feature tem impacto mínimo no schema persistido. A maior parte é **derivada em
leitura**. A única mudança de schema é o `default` de `profiles.points`.

## Alteração de Schema

### `profiles.points` — default 1000 → 0

Definição atual (`supabase/migrations/001_create_profiles.sql:8`):

```sql
points integer not null default 1000 check (points >= 0),
```

Nova migração:

```sql
alter table profiles alter column points set default 0;
-- check (points >= 0) permanece inalterado
```

Efeito: novos perfis criados sem informar `points` nascem com 0. **Linhas existentes
não são afetadas** por uma mudança de `default`.

## OQ-1 — Política para perfis existentes (DECIDIDO: opção B, reset total)

A base atual foi semeada/criada com `default 1000`. **Decisão do dono do produto
(2026-05-29): reset total** — zerar `points`, `wins` e `losses` de **todos** os
perfis existentes na mesma migração. O histórico de partidas (`match_players`)
**permanece intacto** (não é apagado), mas os contadores agregados do perfil voltam a 0.

Migração completa:

```sql
-- novos perfis começam em 0
alter table profiles alter column points set default 0;

-- reset total dos perfis existentes (FR-001, OQ-1 = B)
update profiles set points = 0, wins = 0, losses = 0;
```

**Efeito no dia do deploy**: como `wins + losses = 0` para todos, **ninguém é ativo**
e **ninguém tem divisão** até registrar novas partidas. As divisões só voltam a
aparecer quando a base tiver novamente ≥ 9 ativos.

Opções consideradas e descartadas:

| Opção | Decisão |
|-------|---------|
| A. Não tocar (só default) | Descartada — bases mistas 1000/0 seriam injustas |
| **B. Zerar points + wins + losses** | **ESCOLHIDA** — reset limpo do ranking |
| C. Normalizar (subtrair 1000) | Descartada |
| D. Zerar só points, manter wins/losses | Descartada |

> **Nota de implementação**: confirmar se há outros contadores agregados em `profiles`
> que dependiam da pontuação (não há na 001). O `check (points >= 0)` continua válido.

## Entidades Derivadas (não persistidas)

### Division

Rótulo calculado em tempo de leitura a partir da posição relativa entre ativos.

```
Division = 'Divisão 1' | 'Divisão 2' | 'Divisão 3'
divisaoDoJogador: Division | null   // null = sem divisão
```

`null` ocorre quando:
- o jogador é **inativo** (`wins + losses = 0`), OU
- há **menos de 9 jogadores ativos** no total (nenhuma divisão é atribuída).

### Regra de cálculo (resumo normativo)

Dado o conjunto de perfis ordenado pelo comparador do ranking
(`points DESC, wins DESC, losses ASC, name ASC`):

1. `ativos` = perfis com `wins + losses ≥ 1`, preservando a ordem.
2. `n = ativos.length`.
3. Se `n < 9` → todos sem divisão (`null`).
4. Senão:
   - `sizeDiv1 = floor(n / 3)`
   - `sizeDiv3 = floor(n / 3)`
   - `sizeDiv2 = n − sizeDiv1 − sizeDiv3`  (recebe a sobra)
   - posições `[0, sizeDiv1)` → Divisão 1
   - posições `[sizeDiv1, sizeDiv1 + sizeDiv2)` → Divisão 2
   - posições restantes → Divisão 3
5. Inativos sempre `null`.

A regra de empate na fronteira é resolvida implicitamente pela ordem de desempate
(FR-013): o jogador imediatamente abaixo da fronteira fica na divisão inferior.

### Tabela de exemplos (n ativos → tamanhos)

| n ativos | Div 1 | Div 2 | Div 3 |
|---------:|------:|------:|------:|
| 8        | — (sem divisão) | — | — |
| 9        | 3 | 3 | 3 |
| 10       | 3 | **4** | 3 |
| 11       | 3 | **5** | 3 |
| 12       | 4 | 4 | 4 |
| 13       | 4 | **5** | 4 |
| 30       | 10 | 10 | 10 |
| 31       | 10 | **11** | 10 |

## O que NÃO muda

- Tabela `match_players` e o histórico de pontos por partida (Elo).
- A fórmula Elo e o K-factor.
- As ligas privadas (`league_players` etc.) — sem divisões (Out of Scope).
- A categoria declarada em `profiles.category` (enum incluindo "Iniciante").
