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
