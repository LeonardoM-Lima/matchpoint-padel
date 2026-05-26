# Tasks: MVP PadelUP

**Input**: Design documents from `specs/001-matchpoint-mvp/`
**Prerequisites**: [plan.md](plan.md) · [spec.md](spec.md) · [data-model.md](data-model.md) · [research.md](research.md) · [contracts/](contracts/)

**Organization**: Tasks são agrupadas por user story para habilitar implementação e
teste independentes de cada story. Cada fase entrega um incremento validável.

## Format: `[ID] [P?] [US?] Descrição — caminho exato`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependência entre si)
- **[US1–US4]**: User story à qual a tarefa pertence (obrigatório nas fases de US)
- Setup e Foundational **não** levam tag [US]; Polish **não** leva tag [US]

---

## Phase 1: Setup

**Purpose**: Inicialização do projeto Vite + React + TypeScript + Supabase CLI.
Nenhuma user story pode começar sem esta fase.

- [X] T001 Inicializar projeto Vite com template React-TS em `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `src/main.tsx`, `src/App.tsx`
- [X] T002 [P] Adicionar dependências de runtime ao `package.json`: `@supabase/supabase-js@^2`, `react-router-dom@^6`, `tailwindcss@^3`, `postcss`, `autoprefixer`
- [X] T003 [P] Adicionar dependências de dev/test ao `package.json`: `vitest@^1`, `@testing-library/react@^14`, `@testing-library/user-event@^14`, `jsdom`, `@types/react`, `@types/react-dom`
- [X] T004 [P] Configurar Tailwind CSS mobile-first em `tailwind.config.ts` (content: `src/**`) e adicionar `@tailwind` directives em `src/index.css`
- [X] T005 [P] Configurar TypeScript strict mode em `tsconfig.json` (`"strict": true`, `"noUncheckedIndexedAccess": true`)

**Checkpoint**: `pnpm install && pnpm dev` sobe o app em `http://localhost:5173`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema do banco, RPCs, cliente Supabase, AuthContext, telas de
login/cadastro e logout. **Bloqueia todas as user stories.**

**⚠️ CRITICAL**: Nenhuma user story pode começar até esta fase estar completa.

### Migrations (banco)

- [X] T006 [P] Criar `supabase/migrations/001_create_profiles.sql`: tabela `profiles` (id, user_id UNIQUE, name, email, points DEFAULT 1000, wins DEFAULT 0, losses DEFAULT 0, created_at, updated_at) + função `handle_new_user()` + trigger `on_auth_user_created`
- [X] T007 [P] Criar `supabase/migrations/002_create_matches.sql`: tabela `matches` (id, created_by FK→profiles, team_a_score INT, team_b_score INT, winner_team CHAR(1) CHECK IN('A','B'), played_at DEFAULT now(), created_at)
- [X] T008 [P] Criar `supabase/migrations/003_create_match_players.sql`: tabela `match_players` (id, match_id CASCADE, profile_id FK, team CHAR(1), result CHAR(1), points_before, points_delta DEFAULT 0, points_after DEFAULT 0 CHECK ≥0, UNIQUE(match_id, profile_id))
- [X] T009 Criar `supabase/migrations/004_rls_policies.sql`: habilitar RLS + policies base em `profiles`, `matches` e `match_players`; bloquear `UPDATE` direto de `points`, `wins` e `losses`; bloquear `INSERT` direto em `matches` e `match_players` (registro apenas via RPC); permitir `UPDATE` apenas em campos não sensíveis do próprio `profile` (depende de T006–T008)
- [X] T056a Criar hardening de RLS para `profiles` em `supabase/migrations/004_rls_policies.sql`: restringir `UPDATE` do próprio usuário a campos não sensíveis e impedir alteração direta de `points`, `wins` e `losses` via cliente (depende de T009)
- [X] T056b Criar hardening de RLS para `matches` e `match_players` em `supabase/migrations/004_rls_policies.sql`: bloquear `INSERT` direto via cliente e manter escrita apenas pelas RPCs `register_match` e `delete_match` (depende de T056a)
- [X] T010 Criar `supabase/migrations/005_apply_match_points.sql`: função `apply_match_points(p_match_id uuid)` SECURITY DEFINER — calcula Elo por média de dupla (K=32), UPDATE `match_players` (points_delta, points_after) + `profiles` (points, wins, losses) (depende de T056b)
- [X] T011 Criar `supabase/migrations/006_register_match.sql`: função `register_match(payload jsonb)` SECURITY DEFINER — valida 4 jogadores, 2 por time, placar (FR-005a–c), deriva winner_team server-side, INSERT `matches` + `match_players` com snapshot atômico de `points_before`, chama `apply_match_points`, RETURN match_id (depende de T010)
- [X] T012 Criar `supabase/migrations/007_delete_match.sql`: função `delete_match(p_match_id uuid)` SECURITY DEFINER — verifica criador = auth.uid(), janela de 5 min, reverte `points/wins/losses` de todos os jogadores, DELETE `matches` (match_players via CASCADE) (depende de T011)
- [X] T013 [P] Criar `supabase/seed.sql`: 5–6 usuários de teste com perfis em pontuações variadas (ex.: 750, 920, 1000, 1080, 1250, 1420) cobrindo os três níveis (Iniciante, Amador, Avançado)

### Infraestrutura frontend

- [X] T014 [P] Criar cliente Supabase singleton em `src/lib/supabase.ts`: `createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)`
- [X] T015 [P] Criar `.env.example` com placeholders `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`; criar `.env.local` com credenciais do `supabase start` (não commitar)
- [X] T016 [P] Criar setup de testes com cliente Supabase local e helper `resetDatabase()` em `tests/setup.ts`

### Auth layer

- [X] T017 Criar auth service (signUp com nickname em `user_meta.name`, signIn, signOut, getProfile por user_id) em `src/services/auth.service.ts` (depende de T014)
- [X] T018 Criar `AuthContext` (AuthProvider + hook `useAuth`): estado `session`, `profile`, `loading`; métodos `signIn`, `signUp`, `signOut` em `src/contexts/AuthContext.tsx` (depende de T017)
- [X] T019 Criar `ProtectedRoute` (redireciona para `/login` quando sem sessão) em `src/components/ProtectedRoute.tsx` (depende de T018)
- [X] T020 Criar rotas React Router v6: `/login`, `/register` (públicas); `/`, `/match/new`, `/ranking`, `/matchmaking`, `/profile` (protegidas via ProtectedRoute) em `src/router/index.tsx` + atualizar `src/main.tsx` (depende de T019)
- [X] T021 Criar `LoginScreen`: formulário email + senha, `authService.signIn`, exibição de erro, link para `/register` em `src/screens/LoginScreen.tsx` (depende de T018)
- [X] T022 Criar `RegisterScreen`: formulário email + senha + nickname (FR-001), `authService.signUp`, exibição de erro em `src/screens/RegisterScreen.tsx` (depende de T017)

**Checkpoint**: Cadastro → login → logout funcionam; profile criado automaticamente com 1000 pontos (verificar em Supabase Studio).

---

## Phase 3: User Story 1 — Registrar Partida e Ver Pontuação Atualizada (P1) 🎯 MVP

**Goal**: Usuário autenticado registra partida 2×2 com placar válido; sistema
atualiza pontuação dos 4 jogadores via Elo e exibe os pontos atualizados.

**Independent Test**: Usuário cria conta, registra partida com 4 jogadores e
placar válido (ex.: 6–4), e vê seus pontos alterados no banco (Supabase Studio)
e na home.

### Testes críticos — US1 ⚠️

> Escreva os testes PRIMEIRO. Confirme que falham antes de implementar T025, T026, T027, T028a, T028b, T029, T030a, T030b e T031.

- [X] T023 [P] [US1] Escrever testes de integração Elo em `tests/integration/elo.test.ts`: equilibrado 1000×1000 → vencedores +16/perdedores −16; azarão 800 vence 1200 → +27/−27; favorito 1200 vence 800 → +5/−5; piso 0 (jogador com 30 pts perde → `points_after` = 0)
- [X] T024 [P] [US1] Escrever testes de integração de partida em `tests/integration/match.test.ts`: partida válida com 4 jogadores persiste e atualiza wins/losses; rejeita ≠4 jogadores; rejeita times desbalanceados (≠2 por time); rejeita placar inválido (5–4, 6–5, 8–2, 6–6)

### Implementação — US1

- [X] T025 [P] [US1] Criar match service: `registerMatch(payload: RegisterMatchPayload)` via `supabase.rpc('register_match')` usando adapter `toRegisterMatchRPC` de `contracts/rpc.ts`; `deleteMatch(matchId: string)` via `supabase.rpc('delete_match')` em `src/services/match.service.ts` (depende de T014)
- [X] T026 [P] [US1] Criar componente `ScoreInput`: dois inputs numéricos controlados (time A / time B), hint de formato inline em `src/components/ScoreInput.tsx`
- [X] T027 [US1] Criar hook `useProfile`: busca perfil do usuário atual, expõe `profile` e método `refresh()` em `src/hooks/useProfile.ts` (depende de T018)
- [X] T028a [P] [US1] Criar componente de seleção de 4 jogadores com busca por nome em `src/components/PlayerSelector.tsx` (depende de T027)
- [X] T028b [US1] Integrar atribuição de times A/B, `ScoreInput` e submit com loading em `src/screens/RegisterMatchScreen.tsx` (depende de T025, T026, T028a)
- [X] T029 [US1] Adicionar validação local de placar em `RegisterMatchScreen` com mensagens FR-016: "Selecione 4 jogadores para continuar", "Informe o placar do set", "Placar inválido — um time deve atingir 6 games", "Não foi possível salvar a partida. Tente novamente." em `src/screens/RegisterMatchScreen.tsx` (depende de T028b)
- [X] T030a [US1] Adicionar estado de sucesso pós-registro com pontos atualizados em `src/screens/RegisterMatchScreen.tsx` (depende de T025, T028b)
- [X] T030b [US1] Implementar countdown de 5 minutos e fluxo de undo/exclusão em `src/services/match.service.ts` (depende de T025, T030a)
- [X] T031 [US1] Criar `HomeScreen` shell: exibe nome e pontos atuais do usuário (via `useProfile`), links de navegação para Ranking, Registrar Partida e Matchmaking em `src/screens/HomeScreen.tsx` (depende de T027)

**Checkpoint**: Usuário registra partida via formulário → pontos dos 4 jogadores atualizam no banco → botão "Desfazer" aparece com countdown de 5 min.

---

## Phase 4: User Story 2 — Visualizar Posição no Ranking Global (P2)

**Goal**: Ranking global ordenado por pontos (DESC), com destaque da linha do
usuário atual e diferença de pontos para os vizinhos imediatos.

**Independent Test**: Com 3+ usuários e pontuações distintas, o ranking exibe
todos ordenados corretamente; linha do usuário atual está destacada; delta para
jogador acima e abaixo estão corretos.

### Testes críticos — US2 ⚠️

- [X] T032 [P] [US2] Escrever teste de integração de ranking em `tests/integration/ranking.test.ts`: 3 perfis seedados → ordenados por `points DESC`; desempate por `wins DESC`, depois `losses ASC`; `pointDiffToAbove` e `pointDiffToBelow` corretos para o usuário do meio

### Implementação — US2

- [X] T033 [P] [US2] Criar ranking service: `getRanking()` retorna `RankingEntry[]` ordenado por `points DESC, wins DESC, losses ASC`, com `position` (RANK OVER), `level` (CASE WHEN), `pointDiffToAbove`, `pointDiffToBelow` em `src/services/ranking.service.ts` (depende de T014)
- [X] T034 [P] [US2] Criar componente `RankingRow`: posição, nome, badge de nível (colorido por tier), pontos, delta para vizinhos, destaque visual quando `isCurrentUser` em `src/components/RankingRow.tsx`
- [X] T035 [US2] Criar hook `useRanking`: busca `getRanking()`, identifica entrada do usuário atual por `profile.id`, calcula `pointDiffToAbove/Below` em `src/hooks/useRanking.ts` (depende de T033, T018)
- [X] T036 [US2] Criar `RankingScreen`: lista completa com `RankingRow`, auto-scroll até linha do usuário atual, delta de pontos visível na linha destacada em `src/screens/RankingScreen.tsx` (depende de T034, T035)
- [X] T037 [US2] Expandir `HomeScreen`: adicionar posição no ranking, `pointDiffToAbove`, barra de progresso até próxima posição; substituir shell do T031 em `src/screens/HomeScreen.tsx` (depende de T035)

**Checkpoint**: Ranking reflete pontuações atualizadas após registros de US1; home mostra posição e delta corretamente.

---

## Phase 5: User Story 3 — Encontrar Jogadores para Jogar (P3)

**Goal**: Tela de matchmaking lista outros jogadores com indicadores claros de
equilíbrio, histórico de confrontos e botão de desafio via WhatsApp.

**Independent Test**: Card mostra diferença de pontos clara, indicador de
equilíbrio colorido e botão funcional de WhatsApp; usuário atual excluído da
lista; ordenação por menor `points_diff` ASC.

### Testes críticos — US3 ⚠️

- [X] T038 [P] [US3] Escrever teste de integração de matchmaking em `tests/integration/matchmaking.test.ts`: usuário atual excluído dos resultados; ordenação por `ABS(points - currentUserPoints) ASC`; campos `name`, `level`, `position`, `pointDiff` presentes

### Implementação — US3

- [X] T039 [P] [US3] Adicionar `getMatchmakingSuggestions(currentUserPoints: number)` ao `src/services/ranking.service.ts`: query `profiles WHERE user_id != auth.uid()` ORDER BY `ABS(points - currentUserPoints) ASC`, inclui `level` e `position` via RANK OVER (depende de T033)
- [X] T040 [P] [US3] Criar componente `PlayerCard` informativo: nome, badge de nível, posição no ranking, pontos e diferença de pontos para o usuário atual, sem CTA, em `src/components/PlayerCard.tsx`
- [X] T041 [US3] Criar hook `useMatchmaking` em `src/hooks/useMatchmaking.ts` (depende de T039, T018)
- [X] T042 [US3] Criar `MatchmakingScreen`: lista de `PlayerCard` ordenada por proximidade; estado vazio quando não há outros usuários em `src/screens/MatchmakingScreen.tsx` (depende de T040, T041)

### Reformulação — US3 (cards com equilíbrio e WhatsApp)

- [X] T065 [US3] Atualizar query `getMatchmakingSuggestions` em `src/services/ranking.service.ts` para retornar `points_diff` (ABS da diferença) e `games_together` (partidas já jogadas juntos, calculado no client cruzando `match_id` do usuário com os do candidato) por jogador (depende de T039, T041)
- [X] T066 [P] [US3] Criar função `getMatchLabel` em `src/utils/matchmaking.ts` que recebe `pointsDiff` e `isFavorite` e retorna `{ label, color }`: 0–99 → "Match Perfeito"/verde; 100–200 → "Partida Equilibrada"/verde; 201–300 → "Você é Favorito"/"Desafio Difícil"/amarelo; 301+ → "Grande Favorito"/"Grande Desafio"/vermelho (FR-011b, FR-011c)
- [X] T067 [US3] Atualizar componente `MatchmakingCard` em `src/components/MatchmakingCard.tsx`: avatar com iniciais, nome, nível, posição no ranking, "Diferença: X pts", badge colorido com `match_label`, "Já jogaram Xx"/"Nunca jogaram" (FR-011d), botão "Desafiar no WhatsApp" com link `https://wa.me/?text=…` (FR-011e); remover aproveitamento geral (FR-011f) (depende de T065, T066)
- [X] T068 [US3] Atualizar `MatchmakingScreen` em `src/screens/MatchmakingScreen.tsx` para usar o novo `MatchmakingCard` no lugar de `PlayerCard` (depende de T067, T041)

**Checkpoint**: Card mostra diferença de pontos clara, indicador de equilíbrio colorido e botão funcional de WhatsApp; perfil do usuário logado ausente da lista.

---

## Phase 6: User Story 4 — Visualizar Perfil Pessoal (P3)

**Goal**: Tela de perfil exibe nome, nível, pontos atuais, wins e losses do
jogador.

**Independent Test**: Após registrar partidas, o perfil reflete corretamente
nome, nível, pontuação atual, vitórias e derrotas do jogador.

### Implementação — US4

- [X] T045 [US4] Criar `ProfileScreen`: exibir nome, badge de nível, pontos atuais, vitórias e derrotas em `src/screens/ProfileScreen.tsx` (depende de T027)

**Checkpoint**: Perfil reflete corretamente nome, nível, pontuação, vitórias e derrotas do jogador.

---

## Phase 6.5: User Story 5 — Histórico de Partidas (P3)

**Goal**: Usuário acessa o histórico completo de suas partidas a partir do
perfil, com parceiro, adversários, placar, resultado e variação de pontos.

**Independent Test**: Após registrar partidas, o histórico exibe todas elas com
parceiro e adversários identificados, variação de pontos e resultado (V/D),
ordenadas da mais recente para a mais antiga.

### Implementação — US5

- [X] T059 [US5] Criar `getMatchHistory(userId: string)` em `src/services/match.service.ts` — busca todas as partidas do usuário via `match_players` com parceiro (mesmo time, profile_id diferente), adversários (time oposto) e dados do match (played_at, placar, winner_team, points_before, points_delta, points_after), ordenadas por `played_at DESC` (depende de T025)
- [X] T060 [US5] Criar hook `useMatchHistory` em `src/hooks/useMatchHistory.ts` — chama `getMatchHistory` com o userId do perfil atual e retorna `{ loading, error, matches }` (depende de T059, T018)
- [X] T061 [P] [US5] Criar componente `MatchHistoryCard` em `src/components/MatchHistoryCard.tsx` — exibe uma partida no formato "Com [parceiro] contra [adversário1] e [adversário2]", data, placar, resultado (V/D) e variação de pontos (+27 / -10) (FR-015, FR-016)
- [X] T062 [US5] Criar tela `MatchHistoryScreen` em `src/screens/MatchHistoryScreen.tsx` — lista todas as partidas com scroll usando `MatchHistoryCard`; exibe `EmptyState` quando não há partidas (depende de T060, T061)
- [X] T063 [US5] Adicionar rota `/profile/history` em `src/router/index.tsx` apontando para `MatchHistoryScreen` protegida (depende de T062, T020)
- [X] T064 [US5] Atualizar `ProfileScreen` em `src/screens/ProfileScreen.tsx`: remover botão "Atualizar perfil" (FR-018); adicionar botão "Ver histórico de partidas" abaixo dos stats navegando para `/profile/history` (FR-013) (depende de T045, T063)

**Checkpoint**: Usuário clica em "Ver histórico", vê todas as partidas com parceiro e adversários identificados, variação de pontos e resultado.

---

## Phase 7: Polish

**Purpose**: Estados de loading, mensagens de erro, testes de auth/RLS,
ajustes de layout mobile e validação em dispositivo real.

- [X] T046 [P] Escrever testes de integração auth/RLS em `tests/integration/auth.test.ts`: cliente não autenticado é bloqueado em SELECT de `matches`; cliente autenticado não consegue `UPDATE profiles SET points = 9999` diretamente (rejeita com erro RLS)
- [X] T047 [P] Adicionar skeleton loading (shimmer placeholders) em `RankingScreen`, `MatchmakingScreen`, `ProfileScreen` e `HomeScreen` em `src/screens/`
- [X] T048 [P] Criar componente `ErrorBanner` para erros de RPC (exibe mensagem FR-016 "Não foi possível salvar"); integrar em `RegisterMatchScreen` e `HomeScreen` em `src/components/ErrorBanner.tsx`
- [X] T049 [P] Criar componente `EmptyState` para: matchmaking sem outros usuários, ranking com 1 usuário, perfil sem partidas em `src/components/EmptyState.tsx`
- [X] T050 Criar `NavBar` de navegação inferior (Home, Ranking, Registrar, Matchmaking, Perfil) em `src/components/NavBar.tsx`; integrar em `src/router/index.tsx` no layout das rotas protegidas (depende de T020)
- [X] T051 Aplicar ajustes de layout mobile: `<meta name="viewport">` em `index.html`; container `max-w-md mx-auto` em layout compartilhado; touch targets `min-h-[44px]` em todos os botões em `index.html` + `src/index.css`
- [X] T052 Validar fluxo completo de US1 em Chrome DevTools mobile (viewport 390px): signup → registrar partida → ver ranking atualizado; medir tempo total (SC-001 < 3 min) e latência pós-submissão (SC-002 < 2 s) conforme `quickstart.md §6`
  - ✅ Validado manualmente pelo dev em 2026-05-25 — fluxo completo funcionando: signup, registro de partida e atualização de ranking. SC-001 e SC-002 não cronometrados formalmente; teste cronometrado fica para T058 (com 5 usuários reais).
- [X] T053 Expandir testes de integração auth/RLS em `tests/integration/auth.test.ts`: signup com nickname cria `profiles` automaticamente com 1000 pontos, wins = 0, losses = 0 e level derivado "Amador"
- [X] T054 Expandir testes de integração de partida em `tests/integration/match.test.ts`: `delete_match` permite exclusão pelo criador dentro de 5 min, bloqueia não-criador, bloqueia prazo expirado e reverte points/wins/losses
- [X] T055 Expandir testes de integração de partida em `tests/integration/match.test.ts`: falha durante `register_match` faz rollback completo sem persistir alteração parcial em `matches`, `match_players` ou `profiles`
- [X] T057 Validar aplicação de migrations e seed em `supabase/seed.sql`: executar `supabase db push`, `supabase db seed` e conferir 5-6 perfis cobrindo Iniciante, Amador e Avançado conforme `quickstart.md`
  - **Migrations**: ✅ 001–007 aplicadas no projeto hosted (`rubxwqpdzmnppojebwtr`), confirmado via `supabase migration list --linked` em 2026-05-25.
  - **Seed**: ⏭️ pulado intencionalmente — projeto está em produção real, não faz sentido inserir perfis fake (`ana@example.com`, etc). Seed permanece disponível em `supabase/seed.sql` para uso em ambiente local de desenvolvimento via `supabase db seed`.
- [ ] T058 Validar fluxo completo com 5 jogadores reais em `specs/001-matchpoint-mvp/quickstart.md`: cadastro → registrar partida → ver ranking sem ajuda externa (SC-004)
  - 📋 Protocolo de teste preparado em `specs/001-matchpoint-mvp/test-protocol-t058.md` (folhas de observação, roteiro, critério de aprovação)
  - ⏸️ Aguardando deploy em URL pública + 5 voluntários para executar

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
    └── Phase 2 (Foundational) ← BLOQUEIA tudo abaixo
            ├── Phase 3 (US1 — P1) 🎯 MVP
            ├── Phase 4 (US2 — P2) [pode iniciar após Phase 2; integra com US1]
            ├── Phase 5 (US3 — P3) [pode iniciar após Phase 2; usa ranking.service]
            └── Phase 6 (US4 — P3) [pode iniciar após Phase 2]
                            └── Phase 6.5 (US5 — P3) [depende de Phase 6 (T045)]
                                            └── Phase 7 (Polish) [após todas as US desejadas]
```

### User Story Dependencies

| Story | Depende de | Pode começar após |
|-------|------------|-------------------|
| US1 (P1) | Phase 2 completa | T022 |
| US2 (P2) | Phase 2 completa | T022; integra com useProfile de US1 |
| US3 (P3) | Phase 2 + ranking.service (T033) | T033 de US2 |
| US4 (P3) | Phase 2 completa | T022 |
| US5 (P3) | Phase 6 completa (T045) | T045 de US4 |

### Dentro de cada User Story

1. Testes devem ser escritos **primeiro** e **falhar** antes da implementação
2. Services antes de hooks → hooks antes de screens
3. Componentes atômicos ([P]) antes das screens que os consomem
4. Story completa antes de avançar para a próxima prioridade

### Parallel Opportunities

- **Setup** (T002–T005): todos paralelizáveis após T001
- **Foundational migrations** (T006–T008): paralelizáveis entre si; T009 depende dos três; T056a–T056b vêm em seguida antes de T010
- **Foundational infra** (T013–T016): paralelizáveis entre si
- **US1** (T023–T028a): testes e componentes atômicos paralelizáveis; T028b depende de T025, T026 e T028a
- **US2** (T033–T034): service e componente paralelizáveis; T035–T037 dependem dos dois
- **US3** (T039–T040): service e componente paralelizáveis; T041–T042 dependem dos dois; T065 depende de T039/T041; T066 é paralelizável ([P]); T067 depende de T065 e T066; T068 depende de T067
- **US4**: T045 depende de T027
- **US5** (T059–T064): T059 depende de T025; T060 depende de T059 e T018; T061 é paralelizável ([P]); T062 depende de T060 e T061; T063 depende de T062; T064 depende de T045 e T063
- **Polish** (T046–T058): T047–T049 paralelizáveis entre si; T053–T055 e T057–T058 devem rodar após as migrations/testes base correspondentes

---

## Parallel Example: User Story 1

```
# Escrever testes e implementar componentes atômicos em paralelo:
T023 — Elo tests em tests/integration/elo.test.ts
T024 — Match registration tests em tests/integration/match.test.ts
T025 — match.service.ts
T026 — ScoreInput component

# Após T025 + T026 + T027:
T028a — PlayerSelector component
T028b — RegisterMatchScreen integra seleção, times, score e submit

# Após T028b:
T029 — Validação local + mensagens de erro
T030a — Success state com pontos atualizados
T030b — Countdown + undo/delete flow em match.service.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar **Phase 1**: Setup
2. Completar **Phase 2**: Foundational (CRÍTICO — bloqueia tudo)
3. Completar **Phase 3**: User Story 1
4. **PARAR e VALIDAR**: registrar partida funciona; pontos mudam no banco
5. Deploy/demo se aprovado

### Incremental Delivery

1. Phase 1 + Phase 2 → fundação pronta
2. Phase 3 (US1) → registrar partida funciona → **MVP!** deploy/demo
3. Phase 4 (US2) → ranking + home completos → deploy/demo
4. Phase 5 (US3) → matchmaking → deploy/demo
5. Phase 6 (US4) → perfil → deploy/demo
5.5. Phase 6.5 (US5) → histórico de partidas → deploy/demo
6. Phase 7 → polish → release

### Parallel Team Strategy

Com dois ou mais desenvolvedores:

1. Time completa Phase 1 + Phase 2 junto
2. Após Phase 2:
   - Dev A: US1 (Phase 3)
   - Dev B: inicia US2 (Phase 4) — pode criar `ranking.service.ts` e `RankingRow` em paralelo com US1
3. US3 inicia após `ranking.service.ts` de US2 estar disponível (T033)
4. US4 pode iniciar a qualquer momento após Phase 2

---

## Notes

- `[P]` = arquivos diferentes, sem dependências entre as tasks marcadas
- Tag `[US?]` mapeia cada task à user story correspondente para rastreabilidade
- Cada user story deve ser completável e testável de forma independente
- Confirme que os testes **falham** antes de implementar
- Faça commit após cada task ou grupo lógico concluído
- Pare a cada **Checkpoint** para validar a story de forma isolada
- Evite: tasks vagas, conflitos no mesmo arquivo, dependências cross-story que quebrem a independência

---

**Total**: 69 tasks · **US1**: 11 tasks (T023–T027, T028a–T030b, T031) · **US2**: 6 tasks (T032–T037) · **US3**: 9 tasks (T038–T042, T065–T068) · **US4**: 1 task (T045) · **US5**: 6 tasks (T059–T064) · **Setup**: 5 · **Foundational**: 19 · **Polish**: 12
