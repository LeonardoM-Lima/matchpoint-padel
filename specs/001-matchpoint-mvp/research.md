# Research: MVP MatchPoint Padel

**Branch**: `001-matchpoint-mvp` | **Date**: 2026-05-04

## Decisions

### 1. Stack: React + Vite + Supabase

**Decision**: React 18 + Vite 5 + Supabase como BaaS completo (Auth, DB, RLS, RPC).

**Rationale**:
- Elimina backend Node/Express (Princípio I — Simplicidade).
- React tem a mesma mental model do React Native — path de migração direto para
  mobile reutilizando `services/`, `hooks/` e `contexts/`.
- Vite oferece HMR ultrarrápido e build otimizado para produção.
- Supabase é open-source, tem CLI para desenvolvimento local (`supabase start`)
  e plano hosted gratuito adequado para validação do MVP.

**Alternatives considered**:
- Firebase: Propriedade Google, lock-in maior, sem SQL relacional nativo —
  prejudica integridade de dados (Princípio VII).
- PocketBase: Menor ecossistema, autenticação menos madura.
- Backend Express + PostgreSQL: Viola Princípio I para o MVP (complexidade
  desnecessária antes de validar o produto).

---

### 2. Sistema de Rating: Elo adaptado para duplas

**Decision**: Elo padrão com K=32 aplicado sobre a média de pontos de cada
dupla. Implementado em PostgreSQL (função SECURITY DEFINER).

**Fórmula**:
```
avg_winner  = (points_a1 + points_a2) / 2
avg_loser   = (points_b1 + points_b2) / 2
exp_winner  = 1 / (1 + 10 ^ ((avg_loser − avg_winner) / 400))
delta_win   = round(32 × (1 − exp_winner))
delta_loss  = round(32 × (0 − (1 − exp_winner)))
points_after = max(0, points_before + delta)
```

**Exemplos verificados (K=32)**:
| Cenário | Dupla A | Dupla B | Vencedor | ΔA | ΔB |
|---------|---------|---------|----------|-----|-----|
| Equilibrado | 1000 | 1000 | A | +16 | −16 |
| Favorito vence | 1200 | 800 | A | +5 | −5 |
| Azarão vence | 800 | 1200 | A | +27 | −27 |
| Piso aplicado | 30 | 1000 | B | 0 (piso) | −5 |

**Rationale**:
- Algoritmo amplamente compreendido, testável e justo para o contexto.
- chess.com usa K=32 para jogadores com histórico curto — adequado para o MVP.
- K fixo no MVP: ajuste dinâmico por nível é otimização pós-MVP (Princípio I).
- Implementação em PostgreSQL garante atomicidade (Princípio VII) e impede
  manipulação pelo cliente (Princípio V).

**Alternatives considered**:
- TrueSkill (Microsoft): Mais preciso para multiequipe, porém over-engineering
  para MVP com K fixo.
- Glicko-2: Considera variância do rating — candidato para pós-MVP.
- Rating simples (+10/−10 fixo): Não considera força dos adversários — injusto
  e não incentiva jogar contra adversários mais fortes.

---

### 3. Segurança: RLS + SECURITY DEFINER

**Decision**: RLS em todas as tabelas; funções de mutação de pontuação com
`SECURITY DEFINER`.

**Rationale**:
- `SECURITY DEFINER` permite que `apply_match_points` e `delete_match` atualizem
  `profiles.points` mesmo sem o cliente ter permissão de UPDATE — implementa
  Princípio V diretamente no banco, sem depender de validação no frontend.
- RLS garante que um usuário só pode ver/editar seu próprio perfil (exceto
  leitura pública do ranking e matchmaking).
- Zero surface de ataque via cliente: o app nunca emite UPDATE em
  `profiles.points` diretamente.

---

### 4. Estilização: Tailwind CSS

**Decision**: Tailwind CSS com configuração mobile-first.

**Rationale**:
- Utilitários mobile-first por padrão (`sm:`, `md:` são breakpoints crescentes).
- NativeWind é o equivalente Tailwind para React Native — as mesmas classes
  facilitam a migração futura (Princípio III).
- Sem CSS-in-JS nem styled-components — menos abstração (Princípio I).

**Alternatives considered**:
- Chakra UI / MUI: Opinionated, mais pesado, dificulta migração React Native.
- CSS Modules: Válido, mas sem path direto para React Native.

---

### 5. Testes: Vitest + Supabase local

**Decision**: Vitest para unit e integração; `supabase start` para ambiente de
teste real.

**Rationale**:
- Vitest é compatível com Vite sem configuração extra, mais rápido que Jest.
- `supabase start` sobe PostgreSQL + Auth + PostgREST localmente via Docker —
  testes de integração contra banco real, sem mocks (Princípio VI).
- Testing Library foca em comportamento do usuário, não em implementação.

**13 casos de teste críticos**:
1. Elo: dupla equilibrada (1000 vs 1000) → delta ≈ ±16.
2. Elo: dupla fraca vence forte → delta alto para vencedores.
3. Elo: dupla forte vence fraca → delta baixo para vencedores.
4. Elo: piso 0 — pontuação nunca fica negativa.
5. `register_match`: persiste `points_before`, `points_delta`, `points_after`.
6. `register_match`: rejeita partida com ≠ 4 jogadores.
7. `register_match`: rejeita times desbalanceados (≠ 2 por time).
8. `register_match`: wins/losses atualizam corretamente.
9. `register_match`: rejeita placar inválido (ex: 5–4, 8–2).
10. Ranking: ordena por points DESC, total_matches DESC no desempate.
11. Matchmaking: exclui o próprio usuário e ordena por |delta de pontos|.
12. Signup: trigger cria profile automaticamente com 1000 pontos.
13. RLS: cliente não autenticado é bloqueado; cliente autenticado não consegue
    UPDATE direto em `profiles.points`.

---

### 6. Validação de placar (clarificado no /speckit-clarify)

**Decision**: Validar regras de padel padrão para sets.

**Regra implementada**:
```
Set válido ⟺
  (winner = 6 AND loser ∈ {0, 1, 2, 3, 4})
  OR (winner = 7 AND loser ∈ {5, 6})
```

**Validação dupla**: frontend (UX imediata) + RPC no banco (autoridade final).
Exemplos válidos: 6–0, 6–4, 7–5, 7–6.
Exemplos inválidos: 5–4, 6–5, 8–2, 0–0.

---

### 7. Nível do jogador (clarificado no /speckit-clarify)

**Decision**: Tiers calculados automaticamente; campo derivado, não armazenado.

**Faixas**:
| Faixa de pontos | Nível |
|-----------------|-------|
| 0–799 | Iniciante |
| 800–1299 | Amador (nível inicial — 1000 pts) |
| 1300+ | Avançado |

**Implementação**: `CASE WHEN` no `SELECT`, não como coluna em `profiles`.
Recalculado automaticamente a cada query.

---

### 8. Janela de exclusão de partida (clarificado no /speckit-clarify)

**Decision**: Criador pode excluir partida nos primeiros 5 minutos; sistema
reverte pontuação via RPC `delete_match` (SECURITY DEFINER).

**Fluxo**:
1. Verifica `auth.uid() = matches.created_by`.
2. Verifica `now() - matches.created_at < interval '5 minutes'`.
3. Reverte `profiles.points`, `wins`, `losses` usando `match_players.points_before`.
4. Deleta `match_players` (ON DELETE CASCADE) + `matches`.

---

### 9. Desempate no ranking (clarificado no /speckit-clarify)

**Decision**: Empate de pontos desempatado pelo total de partidas jogadas
(`wins + losses DESC`).

**Rationale**: Incentiva engajamento — jogar mais partidas garante desempate
favorável, alinhando-se ao objetivo do produto.

---

### 10. Formato de partida: 1 set único no MVP

**Decision**: Cada partida registrada no MVP tem exatamente **1 set**. O schema
usa os campos `team_a_score` e `team_b_score` (sem sufixo `_set1`). Campos de
set 2 não existem.

**Rationale**:
- Simplifica schema, RPC e UI — sem lógica condicional para "melhor de X sets"
  (Princípio I — Simplicidade).
- Padel amador frequentemente joga super tie-break em vez de set 2 — 1 set
  único é o caso de uso mais comum para o público-alvo do MVP.
- Migração para múltiplos sets é pós-MVP: adicionar colunas é non-breaking.

**Convenção de nomes**:
- Banco: `matches.team_a_score`, `matches.team_b_score`
- DTO TypeScript: `MatchRecord.teamAScore`, `MatchRecord.teamBScore`
- RPC wire format: `team_a_score`, `team_b_score`

**Alternatives considered**:
- `team_a_score_set1` + `team_a_score_set2` (nullable): Introduz colunas
  nullable desnecessárias no MVP; validação mais complexa; descartado.
