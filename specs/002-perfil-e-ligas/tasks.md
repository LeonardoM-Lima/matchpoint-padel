# Tasks: Perfil e Ligas Privadas

**Input**: Design documents from `specs/002-perfil-e-ligas/`
**Prerequisites**: [plan.md](plan.md) · [spec.md](spec.md) · [data-model.md](data-model.md) · [research.md](research.md) · [contracts/](contracts/)
**Depends on**: MVP (001-matchpoint-mvp) completo.

**Organization**: Tasks agrupadas por user story. Setup e Foundational não levam tag [US]; Polish não leva tag [US].

## Format: `[ID] [P?] [US?] Descrição — caminho exato`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependência entre si)
- **[US1–US5]**: User story à qual a tarefa pertence

---

## Phase 1: Setup

Sem dependências novas — toda a infraestrutura (Vite, React, Supabase, testes)
já está pronta no MVP. Nada a fazer nesta fase.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Migrations de schema, ENUMs, helpers de RLS, Storage buckets, RPCs v2.
**⚠️ CRITICAL**: Nenhuma user story pode começar até esta fase estar completa.

> **Ordem das migrations** (rigorosa):
> 008 → 009 → 010 → 011 → 012 (helpers) → 013 (RLS) → 014 (RPCs admin) →
> 015 (eligible) → 016 (apply_match_points v2) → 017 (register v2) →
> 018 (delete v2) → 019 (Storage)

### Migrations de schema (tabelas e tipos)

- [ ] T101 [P] Criar `supabase/migrations/008_profile_avatar_category.sql`:
  `CREATE TYPE player_category AS ENUM ('1a','2a','3a','4a','5a','6a','Open','Iniciante')`
  PRIMEIRO, seguido de `ALTER TABLE profiles ADD avatar_url text, ADD category
  player_category`. Ordem invertida quebra a migration (FK do tipo).
- [ ] T102 [P] Criar `supabase/migrations/009_create_leagues.sql`: tabela `leagues`
  (`id`, `owner_id` FK→profiles ON DELETE CASCADE, `name` CHECK 3–40, `cover_url`,
  `created_at`, `updated_at`) + índice em `owner_id`. **Sem RLS nesta migration** —
  policies vão em 013.
- [ ] T103 [P] Criar `supabase/migrations/010_create_league_players.sql`: tabela
  `league_players` (`id`, `league_id` FK CASCADE, `profile_id` FK CASCADE,
  `points` DEFAULT 0 CHECK ≥0, `wins`, `losses`, `joined_at`,
  `UNIQUE(league_id, profile_id)`) + índices. **Sem RLS.**
- [ ] T104 [P] Criar `supabase/migrations/011_create_match_leagues.sql`: tabelas
  `match_leagues` (`match_id` PK FK CASCADE, `league_id` `NOT NULL`
  REFERENCES leagues ON DELETE SET NULL) + `match_league_players`
  (`league_id` REFERENCES leagues ON DELETE **SET NULL** — preserva histórico,
  FR-028; `league_points_before/delta/after`, `UNIQUE(match_id, profile_id)`,
  CHECK `league_points_after ≥ 0`). **Sem RLS.**

### Helpers de RLS (quebram recursão)

- [ ] T105 Criar `supabase/migrations/012_league_helper_functions.sql`:
  `is_league_member(uuid)` e `is_league_owner(uuid)` ambas `SECURITY DEFINER`,
  `STABLE`, `SET search_path = public`; `REVOKE ALL FROM PUBLIC` +
  `GRANT EXECUTE TO authenticated` (depende de T102, T103)

### RLS Policies (separadas das migrations de tabela — corrige M1)

- [ ] T106 Criar `supabase/migrations/013_league_rls_policies.sql`:
  `ENABLE RLS` em `leagues`, `league_players`, `match_leagues`,
  `match_league_players`. Policies SELECT usando `is_league_owner()`/
  `is_league_member()` (sem subqueries que disparariam recursão). Sem policies
  diretas para INSERT/UPDATE/DELETE — mutações só via RPC SECURITY DEFINER
  (depende de T105)

### RPCs administrativas

- [ ] T107 Criar `supabase/migrations/014_league_rpcs.sql`: `create_league`
  (validação `< 3 OR > 40` ao invés de `NOT BETWEEN`; insere liga + dono em
  league_players atomicamente), `update_league` (apenas dono),
  `add_league_member` (apenas dono, valida duplicata),
  `remove_league_member` (dono ou self; dono não pode self-remove),
  `delete_league` (apenas dono — CASCADE limpa tudo) (depende de T106)
- [ ] T108 Criar `supabase/migrations/015_get_eligible_leagues.sql`:
  `get_eligible_leagues_for_match(uuid[])` SECURITY DEFINER retornando ligas
  em que TODOS os `player_ids` são participantes (depende de T106)

### RPCs v2 do registro de partida (ordem crítica)

- [ ] T109 Criar `supabase/migrations/016_apply_match_points_v2.sql`:
  `DROP FUNCTION IF EXISTS apply_match_points(uuid)` + `CREATE` v2 calculando
  Elo da liga separadamente quando `match_leagues.league_id IS NOT NULL`, com
  base nos `league_points_before` da dupla (depende de T106)
- [ ] T110 Criar `supabase/migrations/017_register_match_v2.sql`:
  `DROP FUNCTION IF EXISTS register_match(jsonb)` + `CREATE` v2 que lê
  `league_id` opcional do payload, valida elegibilidade (todos os 4 jogadores
  participam), insere em `match_leagues` + `match_league_players` (snapshot),
  e chama `apply_match_points`. **Depende de T109 (apply_match_points v2)** —
  ordem alfabética da migration garante isso.
- [ ] T111 Criar `supabase/migrations/018_delete_match_v2.sql`:
  `DROP FUNCTION IF EXISTS delete_match(uuid)` + `CREATE` v2 que reverte
  global E liga em uma única transação, tratando `league_id IS NULL` (liga
  excluída) como caso onde só reverte global. Depende de T109.

### Storage

- [ ] T112 Criar `supabase/migrations/019_storage_buckets.sql`: buckets `avatars`
  e `league-covers` (public=true, `file_size_limit=2097152`, `allowed_mime_types`
  JPG/PNG/WebP). Policies para `avatars`: escopadas por
  `(storage.foldername(name))[1] = auth.uid()::text`. Policies para
  `league-covers`: usam `is_league_owner(((storage.foldername(name))[1])::uuid)`
  para garantir que só o dono sobe a capa (depende de T105)

**Checkpoint**: `supabase db push` aplica todas as 12 migrations (008–019) sem
erro; buckets visíveis no Studio; `SELECT is_league_member('00000000-0000-0000-
0000-000000000000')` retorna `false` sem erro de recursão.

---

## Phase 3: User Story 1 — Editar Perfil Pessoal (P1) 🎯

**Goal**: Usuário edita nome, foto e categoria. Alterações refletem em todas as
telas que exibem o jogador.

**Independent Test**: Editar perfil → ver alterações no ranking, matchmaking,
histórico e perfil próprio.

### Testes críticos — US1 ⚠️

> Escrever testes primeiro. Confirmar que falham antes da implementação.

- [ ] T113 [P] [US1] Escrever testes de integração em `tests/integration/storage.test.ts`:
  upload válido (JPG ≤ 2MB) persiste em `avatars/{user_id}/avatar.jpg`;
  upload > 2MB rejeitado pelo bucket; MIME inválido rejeitado;
  usuário B não consegue sobrescrever avatar do usuário A (RLS); upload de
  cover de liga por não-dono rejeitado (helper `is_league_owner`)
- [ ] T114 [P] [US1] Escrever testes em `tests/integration/profile.test.ts`:
  `UPDATE profiles SET name='X'` pelo próprio user passa; UPDATE com `points = 999`
  continua bloqueado (regressão MVP); UPDATE com `category` em valor inválido
  rejeitado pelo ENUM

### Implementação — US1

- [ ] T115 [P] [US1] Criar `src/services/profile.service.ts` com
  `updateProfile(payload: UpdateProfilePayload)` e `uploadAvatar(userId, file)`
  (validação client + upload + UPDATE de `avatar_url`)
- [ ] T116 [P] [US1] Criar `src/components/ImageUpload.tsx`: input file,
  preview, validação client (size + MIME), callback `onUploaded(path)` em
  `src/components/ImageUpload.tsx`
- [ ] T117 [P] [US1] Estender `src/components/Avatar.tsx` para aceitar
  `avatarUrl?: string`: quando presente, gera URL via `getPublicUrl(path,
  { transform: { width:256, height:256, resize:'cover' }})` e **memoiza com
  useMemo** baseado em `(path, size)` para evitar regerar URL em cada render
  (importante em listas longas como ranking); fallback para iniciais quando ausente
- [ ] T118 [P] [US1] Criar `src/components/CategoryBadge.tsx`: badge colorido
  exibindo a categoria humanizada ("1ª", "2ª", ..., "Open", "Iniciante") a
  partir do valor ENUM armazenado (`1a`, `2a`, ...). Mapeamento via `const`
  no client (Display ↔ DB).
- [ ] T119 [US1] Estender `src/hooks/useProfile.ts` expondo `updateProfile` e
  `uploadAvatar`; após sucesso, refresh do profile no contexto (depende de T115)
- [ ] T120 [US1] Criar `src/screens/EditProfileScreen.tsx`: formulário com
  nome (validação 2–30), `ImageUpload` para foto, dropdown de categoria,
  botões salvar/cancelar (depende de T116, T118, T119)
- [ ] T121 [US1] Adicionar rota `/profile/edit` em `src/router/index.tsx`
  protegida; botão "Editar perfil" no `ProfileScreen` navega para a nova rota
  (depende de T120)
- [ ] T122 [US1] Propagar `avatarUrl` em queries de ranking, matchmaking e
  histórico — atualizar `ranking.service.ts`, `match.service.ts` e `RankingRow`,
  `MatchmakingCard`, `MatchHistoryCard` para usar `Avatar` com URL

**Checkpoint**: editar perfil reflete em todas as telas. Avatar e categoria
visíveis no matchmaking e no ranking.

---

## Phase 4: User Story 2 — Criar Liga Privada (P2)

**Goal**: Jogador cria liga com nome e foto. Liga aparece em "Minhas Ligas".

**Independent Test**: Criar liga → ver na lista de "Minhas Ligas" como dono e
único participante.

### Testes críticos — US2 ⚠️

- [ ] T123 [P] [US2] Escrever testes em `tests/integration/leagues.test.ts`:
  `create_league` insere liga + dono em `league_players` atomicamente;
  nome < 3 ou > 40 caracteres rejeitado; usuário sem profile não consegue criar

### Implementação — US2

- [ ] T124 [P] [US2] Criar `src/services/league.service.ts` com
  `createLeague(payload)`, `updateLeague(leagueId, payload)`, `deleteLeague(leagueId)`,
  `getMyLeagues()`, `getLeague(leagueId)`, `uploadCover(leagueId, file)`
- [ ] T125 [P] [US2] Criar `src/hooks/useLeagues.ts` listando minhas ligas
  com `member_count` e `is_owner` (depende de T124)
- [ ] T126 [P] [US2] Criar `src/components/LeagueCard.tsx`: card com cover,
  nome, badge "Dono" se aplicável, contagem de membros
- [ ] T127 [US2] Criar `src/screens/LeaguesScreen.tsx`: lista usando `LeagueCard`,
  botão "Criar nova liga"; EmptyState quando sem ligas (depende de T125, T126)
- [ ] T128 [US2] Criar `src/screens/CreateLeagueScreen.tsx`: formulário com
  nome + `ImageUpload` para cover; após sucesso navega para detalhe da liga
  (depende de T124, T116)
- [ ] T129 [US2] Adicionar rotas `/leagues` e `/leagues/new` em
  `src/router/index.tsx`; adicionar ícone na NavBar (depende de T127, T128)

**Checkpoint**: criar liga aparece em "Minhas Ligas" com dono como único membro.

---

## Phase 5: User Story 3 — Adicionar e Remover Participantes (P2)

**Goal**: Dono busca jogador pelo nickname e adiciona/remove à liga.

**Independent Test**: Dono adiciona jogador X → X vê a liga em "Minhas Ligas";
Dono remove X → X deixa de ver a liga.

### Testes críticos — US3 ⚠️

- [ ] T130 [US3] Escrever testes em `tests/integration/leagues.test.ts`:
  não-dono chamando `add_league_member` recebe erro; adicionar mesmo jogador
  2× retorna `Jogador já participa desta liga`; dono não pode remover a si mesmo;
  participante pode remover a si mesmo (self-remove); SELECT em `league_players`
  por não-participante retorna 0 linhas (RLS sem recursão — T106)

### Implementação — US3

- [ ] T131 [P] [US3] Estender `src/services/league.service.ts` com
  `addMember(leagueId, profileId)`, `removeMember(leagueId, profileId)`,
  `searchProfiles(query)` (busca por nickname para popular o seletor)
- [ ] T132 [P] [US3] Criar `src/hooks/useLeague.ts` retornando liga + ranking +
  permissões (`isOwner`, `isMember`) (depende de T124)
- [ ] T133 [P] [US3] Criar `src/components/LeagueRankingRow.tsx`: linha do
  ranking interno (posição, avatar, nome, categoria, pontos da liga, V/D),
  destaque para o usuário atual
- [ ] T134 [US3] Criar `src/screens/LeagueDetailScreen.tsx`: header com nome,
  cover, contagem, botões condicionais (Editar/Adicionar membro/Excluir liga
  para dono; Sair da liga para não-dono); ranking interno com `LeagueRankingRow`
  (depende de T132, T133)
- [ ] T135 [US3] Criar `src/screens/AddLeagueMemberScreen.tsx`: input de busca
  + lista de resultados + botão "Adicionar"; toast de sucesso/erro
  (depende de T131)
- [ ] T136 [US3] Adicionar rotas `/leagues/:id` e `/leagues/:id/add-member`
  em `src/router/index.tsx`; bloquear acesso a `:id` quando o usuário não é
  participante (mensagem "Você não faz parte desta liga") (depende de T134, T135)
- [ ] T137 [US3] Adicionar fluxo de exclusão de liga com confirmação modal no
  `LeagueDetailScreen`: chama `deleteLeague` e volta para `/leagues`
  (depende de T134)

**Checkpoint**: dono adiciona/remove membros; ranking reflete imediatamente;
permissões funcionam.

---

## Phase 6: User Story 4 — Registrar Partida Vinculada (P1) 🎯

**Goal**: Tela de registrar partida tem dropdown para vincular a uma liga;
quando vinculada, atualiza ambos os rankings.

**Independent Test**: 4 jogadores numa liga registram partida vinculada →
ranking global E interno atualizados com mesmo Elo.

### Testes críticos — US4 ⚠️

- [ ] T138 [P] [US4] Escrever testes em `tests/integration/match-league.test.ts`:
  partida vinculada atualiza `profiles.points` E `league_players.points` na
  mesma transação; partida com 1 jogador fora da liga retorna erro
  "Todos os 4 jogadores devem participar da liga" e NÃO persiste em `matches`;
  partida sem `league_id` NÃO insere em `match_leagues`/`match_league_players`
- [ ] T139 [P] [US4] Escrever testes em `tests/integration/match-league.test.ts`:
  `delete_match` reverte ambas as dimensões; falha simulada em `apply_match_points`
  faz rollback completo (sem entradas parciais); criador removido da liga ainda
  consegue chamar `delete_match` dentro da janela de 5 min (reversão da liga
  ocorre normalmente)
- [ ] T140 [P] [US4] Escrever teste de Elo de fronteira em
  `tests/integration/match-league.test.ts`: primeira partida da liga
  (todos com `league_points = 0`) → deltas ±16 (mesma fórmula equilibrada);
  perdedores ficam com 0 (piso aplicado); cobre cenário L1 do research
- [ ] T141 [P] [US4] Escrever teste de liga excluída antes do delete em
  `tests/integration/match-league.test.ts`: registrar partida vinculada,
  excluir liga, executar `delete_match` dentro de 5 min — reversão global
  acontece; nenhuma operação de liga (linha em `match_leagues` tem `league_id
  IS NULL` e `league_players` já foi removida via CASCADE)

### Implementação — US4

- [ ] T142 [US4] Estender `src/services/match.service.ts`: `registerMatch` aceita
  `leagueId?: string` no payload, usa `toRegisterMatchRPCV2` (depende de T109–T111)
- [ ] T143 [US4] Criar `src/hooks/useEligibleLeagues.ts`: recebe `playerIds:
  string[]` e dispara `get_eligible_leagues_for_match` quando há 4 IDs válidos;
  retorna `{ leagues, loading }` (depende de T108)
- [ ] T144 [P] [US4] Criar `src/components/LeagueSelector.tsx`: dropdown com
  opções "Nenhuma" + ligas elegíveis; estado disabled enquanto < 4 jogadores
- [ ] T145 [US4] Estender `src/screens/RegisterMatchScreen.tsx`: adicionar
  `LeagueSelector` abaixo do `PlayerSelector`, usando `useEligibleLeagues`;
  enviar `leagueId` no payload de submit (depende de T142, T143, T144)
- [ ] T146 [US4] Atualizar `MatchHistoryCard` para exibir badge "Liga: <nome>"
  quando a partida foi vinculada — ler `match_leagues` no fetch do histórico
  e expor `leagueName` (depende de T122)

**Checkpoint**: partida vinculada atualiza ambos os rankings; histórico exibe
o badge da liga.

---

## Phase 7: User Story 5 — Visualizar Ranking da Liga (P2)

**Goal**: Tela da liga mostra ranking interno ordenado por pontos da liga.

**Independent Test**: Após registrar partida vinculada com ≥ 2 membros, abrir
a liga mostra o ranking correto com desempate.

### Testes críticos — US5 ⚠️

- [ ] T147 [US5] Escrever testes em `tests/integration/leagues.test.ts`:
  ranking interno ordenado por `points DESC, wins DESC, losses ASC`;
  participante novo aparece com 0 pontos; usuário atual destacado

### Implementação — US5

> O ranking já é exibido na `LeagueDetailScreen` (T134). Esta fase apenas
> garante regressão e ajustes finais.

- [ ] T148 [US5] Garantir que `useLeague` calcula `position` no client com
  `RANK` simples (loop) e marca `isCurrentUser` na entrada do usuário logado
  (depende de T132)
- [ ] T149 [US5] Aplicar destaque visual na linha do usuário atual no
  `LeagueRankingRow` (mesmo padrão do `RankingRow` global) (depende de T133)

**Checkpoint**: ranking interno reflete pontos das partidas vinculadas com
ordenação e desempate corretos.

---

## Phase 8: Polish

- [ ] T150 [P] Adicionar skeleton de loading em `LeaguesScreen`,
  `LeagueDetailScreen` e `EditProfileScreen` (mesmo padrão do MVP)
- [ ] T151 [P] Adicionar `EmptyState` para: "Nenhuma liga ainda" (sem ligas);
  "Nenhum membro na liga" (impossível mas defensivo); resultados vazios em
  `AddLeagueMemberScreen`
- [ ] T152 [P] Adicionar mensagens de erro consistentes com FR-029 em todos os
  formulários da feature; reusar `ErrorBanner` do MVP
- [ ] T153 Validar fluxos completos em Chrome DevTools mobile (390 px):
  editar perfil → criar liga → adicionar 3 membros → registrar partida vinculada
  → ver ranking interno atualizado. Medir SC-001 (5s edição), SC-003 (5min fluxo
  completo), SC-002 (atomicidade do registro vinculado < 2s)
- [ ] T154 Validar transformações on-the-fly do Storage: avatar 256×256 carrega
  rapidamente, fallback para iniciais funciona quando `avatar_url` é NULL,
  memoização do `Avatar` evita regerar URL em listas longas
- [ ] T155 Validar atomicidade global+liga: registrar 5 partidas vinculadas e
  conferir que `points_delta` e `league_points_delta` podem divergir (bases
  distintas), mas sempre persistem juntos (rollback total em qualquer falha)

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 2 (Foundational) ← BLOQUEIA tudo abaixo
    ├── Phase 3 (US1 — P1) 🎯 Perfil
    ├── Phase 4 (US2 — P2)  [após Foundational]
    │       └── Phase 5 (US3 — P2)  [após US2]
    │               └── Phase 7 (US5 — P2)  [após US3 (ranking exibido em LeagueDetail)]
    └── Phase 6 (US4 — P1) 🎯 Vínculo partida↔liga
            └── Phase 8 (Polish) [após todas as US]
```

### User Story Dependencies

| Story | Depende de | Pode começar após |
|-------|------------|-------------------|
| US1 (P1) Editar perfil | Phase 2 (T101, T112) | T112 |
| US2 (P2) Criar liga | Phase 2 (T102–T107) | T107 |
| US3 (P2) Membros | US2 + Phase 2 (T107) | T128 |
| US4 (P1) Vincular partida | Phase 2 (T108–T111) + US2 | T111 |
| US5 (P2) Ranking liga | US3 (LeagueDetail) | T133 |

### Dentro de cada User Story

1. Testes primeiro (devem falhar)
2. Migrations e RPCs antes de services
3. Services antes de hooks; hooks antes de screens
4. Componentes atômicos [P] antes das screens que os consomem

### Parallel Opportunities

- **Foundational** (T101–T104): paralelizáveis entre si; T105 (helpers)
  depende de T102+T103; T106 (RLS) depende de T105; T107 (RPCs admin) depende
  de T106; T108 (eligible) depende de T106; T109 (apply v2) depende de T106;
  T110 (register v2) e T111 (delete v2) dependem de T109; T112 (Storage) depende
  de T101 e T105 (precisa de `is_league_owner`)
- **US1** (T113–T117): testes e componentes paralelos; T118 depende de T114;
  T119 depende de T115/T117/T118
- **US2** (T122–T125): testes e componentes paralelos; T126–T128 sequenciais
- **US3** (T130–T132): paralelos; T133–T136 sequenciais
- **US4** (T137–T138, T141): paralelos; T139–T142 sequenciais
- **Polish** (T147–T149): paralelizáveis entre si

---

## Implementation Strategy

### Entrega incremental

1. Phase 2 (Foundational) → fundação pronta
2. Phase 3 (US1) → perfil editável → deploy/demo
3. Phase 4 + Phase 5 (US2 + US3) → ligas funcionais sem vínculo → deploy/demo
4. Phase 6 (US4) → vínculo partida↔liga → **incremento P1 completo** → deploy/demo
5. Phase 7 (US5) → polish do ranking interno
6. Phase 8 (Polish) → release

### MVP da feature (entrega mínima)

- Phase 2 completa
- Phase 3 (perfil editável) — base de personalização
- Phase 6 (vínculo partida↔liga) — exige Phase 4+5 para fazer sentido

> **Recomendação**: não pular Phase 4/5 — sem ligas criadas, US4 é dead-end.

---

## Notes

- `[P]` = arquivos diferentes, sem dependências entre tarefas marcadas
- Mesma convenção do MVP: testes falham antes de implementar
- Comprometer após cada task ou grupo lógico
- Parar a cada checkpoint para validar a story isoladamente
- `apply_match_points` v2 é incremental: comportamento sem `league_id` é
  idêntico ao do MVP (regressão zero)

---

**Total**: 55 tasks · **Foundational**: 12 (T101–T112) · **US1**: 10 (T113–T122) ·
**US2**: 7 (T123–T129) · **US3**: 8 (T130–T137) · **US4**: 9 (T138–T146) ·
**US5**: 3 (T147–T149) · **Polish**: 6 (T150–T155)
