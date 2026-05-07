# Implementation Plan: MVP MatchPoint Padel

**Branch**: `001-matchpoint-mvp` | **Date**: 2026-05-04 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-matchpoint-mvp/spec.md`

## Summary

MVP do MatchPoint Padel: plataforma web mobile-first para registro de partidas
2x2 de padel com sistema de rating dinâmico inspirado no Elo. No MVP, cada
partida consiste em exatamente **1 set** — campos de set 2 não existem no
schema. Backend serverless via Supabase (Auth + PostgreSQL + RLS + RPC).
Frontend em React + Vite + TypeScript. Sem backend customizado — toda lógica
de pontuação centralizada na função PostgreSQL `apply_match_points` (SECURITY
DEFINER).

O registro de partida executa em **transação atômica única** via
`register_match`: qualquer falha (validação, inserção ou cálculo Elo) causa
rollback completo — nenhuma alteração parcial persiste em `matches`,
`match_players` ou `profiles`. O snapshot de `points_before` é capturado
dentro da mesma transação, prevenindo condições de corrida (CHK010, CHK039).
Arredondamento MUST usar round half up (ex: 16.5 → 17).

Perfis são criados automaticamente pelo trigger `handle_new_user`. Se o trigger
falhar, o signup MUST ser revertido — usuário não pode existir sem profile.

`delete_match` MUST retornar erro `MATCH_DELETE_FORBIDDEN` com status 403 e
mensagem "Apenas o criador da partida pode excluir este registro." quando um
jogador que não é o criador tentar excluir a partida.

## Data Access Patterns

### Query: Histórico de partidas do usuário (`src/services/match.service.ts`)

Busca todas as partidas de um jogador via `match_players`, resolvendo parceiro e
adversários em uma única query para evitar N+1. Nenhuma migration nova é
necessária — os dados já existem em `match_players` e `matches`.

```sql
-- Lógica equivalente à query Supabase JS
SELECT
  mp.match_id,
  m.played_at,
  m.team_a_score,
  m.team_b_score,
  m.winner_team,
  mp.team         AS user_team,
  mp.points_before,
  mp.points_delta,
  mp.points_after,
  -- parceiro: mesmo time, diferente do usuário
  partner.profile_id  AS partner_id,
  partner_p.name      AS partner_name,
  -- adversários: time oposto
  opp1.profile_id     AS opponent1_id,
  opp1_p.name         AS opponent1_name,
  opp2.profile_id     AS opponent2_id,
  opp2_p.name         AS opponent2_name
FROM match_players mp
JOIN matches m ON m.id = mp.match_id
-- parceiro
JOIN match_players partner
  ON  partner.match_id   = mp.match_id
  AND partner.team       = mp.team
  AND partner.profile_id <> mp.profile_id
JOIN profiles partner_p ON partner_p.id = partner.profile_id
-- adversários (ordenados para posição fixa)
JOIN match_players opp1
  ON  opp1.match_id   = mp.match_id
  AND opp1.team      <> mp.team
JOIN profiles opp1_p ON opp1_p.id = opp1.profile_id
JOIN match_players opp2
  ON  opp2.match_id   = mp.match_id
  AND opp2.team      <> mp.team
  AND opp2.profile_id > opp1.profile_id   -- evita duplicata de par
JOIN profiles opp2_p ON opp2_p.id = opp2.profile_id
WHERE mp.profile_id = :current_user_id
ORDER BY m.played_at DESC;
```

**Implementação Supabase JS** (sem SQL raw):

```ts
supabase
  .from('match_players')
  .select(`
    match_id,
    team,
    points_before,
    points_delta,
    points_after,
    matches (played_at, team_a_score, team_b_score, winner_team),
    matches!inner (
      match_players (
        team,
        profile_id,
        profiles (name)
      )
    )
  `)
  .eq('profile_id', userId)
  .order('matches(played_at)', { ascending: false })
```

> A separação de parceiro × adversários é feita no lado TypeScript após o
> fetch, filtrando `match_players` pelo `team` do usuário e pelo `profile_id`.
> Formato de exibição: "Com [parceiro] contra [adversário1] e [adversário2]"
> (FR-016).

### Query: Matchmaking (`src/services/ranking.service.ts`)

Busca todos os jogadores excluindo o usuário atual, calculando diferença de
pontos e confrontos diretos. Nenhuma migration nova é necessária — `profiles`
e `match_players` já contêm todos os dados necessários.

```sql
-- Lógica equivalente à query Supabase JS
SELECT
  p.id,
  p.name,
  p.points,
  ABS(p.points - :current_user_points)  AS points_diff,
  -- posição no ranking via window function
  RANK() OVER (ORDER BY p.points DESC, p.wins DESC, p.losses ASC) AS ranking_position,
  -- nível derivado da pontuação
  CASE
    WHEN p.points < 800  THEN 'Iniciante'
    WHEN p.points < 1300 THEN 'Amador'
    ELSE 'Avançado'
  END AS level,
  -- partidas jogadas juntos (usuário atual aparece na mesma partida)
  COUNT(DISTINCT mp_them.match_id) FILTER (
    WHERE mp_me.match_id IS NOT NULL
  ) AS games_together
FROM profiles p
LEFT JOIN match_players mp_them
  ON mp_them.profile_id = p.id
LEFT JOIN match_players mp_me
  ON  mp_me.match_id   = mp_them.match_id
  AND mp_me.profile_id = :current_user_id
WHERE p.user_id <> auth.uid()
GROUP BY p.id
ORDER BY points_diff ASC;
```

**Implementação Supabase JS** (sem SQL raw):

```ts
// 1. buscar perfis excluindo usuário atual
const { data: players } = await supabase
  .from('profiles')
  .select('id,name,points,wins,losses')
  .neq('user_id', currentUserId)

// 2. calcular games_together para cada jogador via match_players
//    (feito em uma segunda query ou resolvido no client com os dados já em cache)
const { data: myMatches } = await supabase
  .from('match_players')
  .select('match_id')
  .eq('profile_id', currentProfileId)

// Para cada candidato, contar quantos match_ids em comum
// games_together = interseção entre myMatchIds e candidateMatchIds
```

> `games_together` é calculado no lado TypeScript cruzando os `match_id` do
> usuário atual com os de cada candidato. Para MVP (5–50 usuários), essa
> abordagem evita SQL complexo sem impacto de performance.

**Lógica do `match_label`** (calculada no frontend — sem round-trip ao banco):

```ts
function getMatchLabel(pointsDiff: number, isFavorite: boolean): string {
  if (pointsDiff <= 99)  return 'Match Perfeito';
  if (pointsDiff <= 200) return 'Partida Equilibrada';
  if (pointsDiff <= 300) return isFavorite ? 'Você é Favorito' : 'Desafio Difícil';
  return isFavorite ? 'Grande Favorito' : 'Grande Desafio';
}
// isFavorite = currentUserPoints > candidatePoints
```

**Link WhatsApp** (gerado no frontend):

```ts
const message = encodeURIComponent(
  `Oi ${name}! Te desafio para uma partida de padel pelo MatchPoint. Topa?`
);
const url = `https://wa.me/?text=${message}`;
```

> A URL `https://wa.me/?text=…` abre o WhatsApp sem exigir número fixo —
> o usuário escolhe o contato na hora (FR-011e).

## Technical Context

**Language/Version**: TypeScript (strict mode), React 18+, Node 20+ (dev tools)
**Primary Dependencies**: React + Vite, Tailwind CSS, React Router v6,
@supabase/supabase-js, Vitest + @testing-library/react
**Storage**: Supabase PostgreSQL (hosted) + Supabase local para testes (`supabase start`)
**Testing**: Vitest + Testing Library; integração contra instância local do Supabase
**Target Platform**: Web mobile-first (viewport ≤ 390 px prioritário); path para React Native
**Project Type**: web-app (BaaS — sem backend Node/Express separado)
**Performance Goals**: Ranking atualizado em < 2 s após submissão (SC-002); fluxo completo em < 3 min no celular (SC-001)
**Constraints**: Sem backend custom; sem Redux; sem GraphQL; pontuação apenas via RPC SECURITY DEFINER; queries públicas de ranking/matchmaking MUST NOT expor email; `profiles.updated_at` é usado para controle de concorrência e atualização de perfil
**Scale/Scope**: MVP — 5–50 usuários reais para validação inicial; escala via Supabase hosted

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Status | Evidência |
|-----------|--------|-----------|
| I. Simplicidade | ✅ PASS | Sem backend custom, sem microserviços; BaaS via Supabase |
| II. Spec como Fonte da Verdade | ✅ PASS | Plano deriva 1:1 das user stories e FRs do spec clarificado |
| III. Mobile-First | ✅ PASS | Tailwind mobile-first; fluxos em ≤ 3 toques; layout para 390 px |
| IV. Fluxo Principal Protegido | ✅ PASS | US1 é Phase 3 (P1); RPC transacional; testes dedicados |
| V. Segurança Básica | ✅ PASS | RLS em todas as tabelas; points só via `apply_match_points` SECURITY DEFINER |
| VI. Testes de Regras Críticas | ✅ PASS | 13 testes cobrindo Elo, partida, ranking, auth e RLS |
| VII. Integridade de Dados | ✅ PASS | FKs, CHECK constraints, UNIQUE (match_id, profile_id), points ≥ 0 |

**Sem violações → Complexity Tracking fica vazio.**

## Project Structure

### Documentation (this feature)

```text
specs/001-matchpoint-mvp/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── types.ts         # DTOs e payloads TypeScript
│   └── rpc.ts           # Wrappers tipados para RPCs
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
├── lib/
│   └── supabase.ts              # Cliente Supabase único (singleton)
├── contexts/
│   └── AuthContext.tsx           # Sessão + perfil do usuário logado
├── services/
│   ├── auth.service.ts           # Cadastro, login, logout
│   ├── match.service.ts          # register_match RPC, delete_match, listagem
│   └── ranking.service.ts        # Ranking, matchmaking
├── hooks/
│   ├── useProfile.ts
│   ├── useRanking.ts
│   └── useMatchmaking.ts
├── screens/
│   ├── LoginScreen.tsx
│   ├── RegisterScreen.tsx
│   ├── HomeScreen.tsx            # US2 — pontos, posição, progresso
│   ├── RankingScreen.tsx         # US2 — ranking global
│   ├── RegisterMatchScreen.tsx   # US1 — fluxo principal
│   ├── MatchmakingScreen.tsx     # US3 — sugestões por nível
│   └── ProfileScreen.tsx         # US4 — perfil pessoal
├── components/
│   ├── RankingRow.tsx
│   ├── PlayerCard.tsx
│   ├── ScoreInput.tsx
│   └── ProtectedRoute.tsx
├── router/
│   └── index.tsx                 # React Router v6 routes
└── main.tsx

supabase/
├── migrations/
│   ├── 001_create_profiles.sql
│   ├── 002_create_matches.sql
│   ├── 003_create_match_players.sql
│   ├── 004_rls_policies.sql
│   ├── 005_apply_match_points.sql
│   ├── 006_register_match.sql
│   └── 007_delete_match.sql
└── seed.sql                      # 5–6 profiles de teste

tests/
├── integration/
│   ├── elo.test.ts               # Cálculo de pontuação Elo
│   ├── match.test.ts             # register_match e delete_match RPCs
│   ├── ranking.test.ts           # Ordenação e desempate
│   └── auth.test.ts              # RLS e autenticação
└── setup.ts                      # Supabase local client + reset helpers
```

**Structure Decision**: Web app com BaaS — sem `backend/` separado. Toda lógica
de negócio reside em `src/services/` (reutilizável no React Native) e no banco
(RPCs). Migrations em `supabase/migrations/` gerenciadas pelo CLI do Supabase.

## Complexity Tracking

> **Sem violações da constituição — seção vazia.**
