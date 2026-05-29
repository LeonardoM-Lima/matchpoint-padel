# Tasks: Feed de Jogadas e Notificações Push

**Input**: Design documents from `specs/003-feed-e-push/`
**Prerequisites**: [plan.md](plan.md) · [spec.md](spec.md) · [data-model.md](data-model.md) · [research.md](research.md) · [contracts/](contracts/)
**Depends on**: MVP (001) e Perfil+Ligas (002) completos. Trigger de ranking
e de liga assumem que `profiles.avatar_url`, `leagues` e `league_players`
existem.

## Format: `[ID] [P?] [US?] Descrição — caminho exato`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependência)
- **[US1–US6]**: User story à qual a tarefa pertence

---

## Phase 1: Setup

Sem dependências novas no client (`web-push` é só Edge Function). Nada a fazer.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extensões, migrations de schema, ENUM, RLS, RPCs, push
explícito no `register_match` v3, cron de retenção, Storage bucket,
Edge Functions.
**⚠️ CRITICAL**: Nenhuma user story pode começar até esta fase estar completa.

> **Ordem das migrations**: 021 → 031 + 032 (sequencial). A numeração real
> começou em 021 porque `020_storage_policy_upsert_fix.sql` foi reservado para
> um patch da feature 002 (fix de policies de Storage). T214 virou a migration
> 032 (`app_settings_for_edge_functions.sql`) — ver nota lá embaixo.

### VAPID e segredos

- [ ] T201 Gerar par de VAPID keys (one-time):
  `npx web-push generate-vapid-keys`. Salvar no gerenciador de senhas do
  time. Adicionar `VITE_VAPID_PUBLIC_KEY` ao `.env.example`.

### Extensões e settings (PRIMEIRO)

- [ ] T202a Criar `supabase/migrations/020_extensions_and_settings.sql`:
  `CREATE EXTENSION IF NOT EXISTS pg_net` + `CREATE EXTENSION IF NOT EXISTS
  pg_cron`. Esta migration **PRECISA rodar antes** de 025–028 que dependem
  das extensões. Em produção, executar manualmente
  `ALTER DATABASE postgres SET app.edge_function_url = '...'` e
  `app.edge_function_key = '...'` (essas settings não são gerenciáveis via
  migration porque dependem do projeto hosted específico).

### Migrations de schema

- [ ] T202 [P] Criar `supabase/migrations/021_create_videos.sql`:
  `CREATE TYPE video_category AS ENUM (...)` antes de `CREATE TABLE videos`
  com `id`, `author_id` FK CASCADE, `title` CHECK 3–80, `category`,
  `storage_path`, `created_at`, `expires_at` (DEFAULT now()+60 days) +
  índices em `created_at DESC`, `expires_at`, `author_id`
- [ ] T203 [P] Criar `supabase/migrations/022_create_video_likes.sql`:
  tabela com `video_id` FK CASCADE, `profile_id` FK CASCADE,
  `created_at`, `UNIQUE(video_id, profile_id)` + índice em `video_id`
- [ ] T204 [P] Criar `supabase/migrations/023_create_push_subscriptions.sql`:
  tabela com `profile_id` FK CASCADE, `endpoint` UNIQUE NOT NULL,
  `p256dh`, `auth`, `user_agent`, `created_at` + índice em `profile_id`

### RLS Policies

- [ ] T205 Criar `supabase/migrations/024_feed_rls_policies.sql`:
  - `videos`: SELECT (não-expirado OU autor); INSERT (own); DELETE (own)
  - `video_likes`: SELECT/INSERT/DELETE apenas próprias linhas
  - `push_subscriptions`: SELECT/INSERT/DELETE apenas próprias linhas
  - Sem UPDATE em nenhuma das três (depende de T202, T203, T204)

### RPCs de feed

- [ ] T206 Criar `supabase/migrations/025_feed_rpcs.sql`:
  - `get_feed(p_limit, p_offset)` SECURITY DEFINER STABLE — clamp [1,50],
    filtra `expires_at > now()`, retorna `like_count` e `viewer_liked`
  - `get_my_videos(p_limit, p_offset)` SECURITY DEFINER STABLE — inclui
    vídeos expirados do próprio user (autor → "Meus vídeos")
  - Ambas: `REVOKE FROM PUBLIC; GRANT EXECUTE TO authenticated`
  - (depende de T205)

### Helper de push

- [ ] T207 Criar `supabase/migrations/026_push_notification_helpers.sql`:
  função `enqueue_push_notification(profile_ids uuid[], title, body, url, tag)`
  SECURITY DEFINER que filtra perfis com subscription ativa e chama
  `pg_net.http_post` para `/send-push-notification`. Sem GRANT para
  authenticated — chamada apenas via outras SECURITY DEFINER (depende de
  T202a, T204)

### Push em eventos (sem triggers granulares)

- [ ] T208 Criar `supabase/migrations/027_register_match_v3.sql`:
  `DROP FUNCTION register_match(jsonb)` (v2 da feature 002) +
  `CREATE FUNCTION register_match(jsonb)` v3 que mantém toda a lógica de
  validação/Elo/liga da v2 + ao final, chama `enqueue_push_notification`
  para cada participante não-criador (push de partida) e calcula posição
  antes/depois usando snapshot de `points_before` para detectar mudança
  ≥ 3 (push de ranking). **Substitui** a v2 da feature 002 (depende de T207)
- [ ] T209 Criar `supabase/migrations/028_league_push_trigger.sql`:
  função `notify_league_added()` SECURITY DEFINER + trigger AFTER INSERT
  em `league_players`. Usa `enqueue_push_notification`. Skip se
  `NEW.profile_id = leagues.owner_id` (autoadição em create_league)
  (depende de T207)

### Retenção (cron + cleanup)

- [ ] T210 Criar `supabase/migrations/029_cleanup_expired_videos.sql`:
  função `cleanup_expired_videos()` SECURITY DEFINER que agrega todos os
  vídeos expirados em **um único jsonb** e chama Edge Function
  `/cleanup-video` em **uma única chamada HTTP** (batch). Schedule:
  `cron.schedule('cleanup-expired-videos', '0 3 * * *', ...)` (depende
  de T202a, T205)

### Storage

- [ ] T211 Criar `supabase/migrations/030_storage_videos_bucket.sql`:
  bucket `videos` (public, 30MB, MP4/MOV/WebM); policies INSERT/UPDATE/DELETE
  escopadas por `(storage.foldername(name))[1] = auth.uid()::text`
  (depende de T202)

### Edge Functions

- [ ] T212 Criar `supabase/functions/send-push-notification/index.ts`:
  validar header `Authorization: Bearer SERVICE_ROLE_KEY`; **guard para
  `profile_ids` vazio retornando `{sent:0, dead:0}`**; ler subscriptions
  por `profile_ids`; chamar `webpush.sendNotification`; remover
  subscriptions com statusCode 410/404. Imports via esm.sh (depende de T201)
- [ ] T213 Criar `supabase/functions/cleanup-video/index.ts`: validar
  service_role; receber `{ items: [{video_id, storage_path}, ...] }`;
  deletar arquivos do bucket `videos` **em lote** via
  `storage.remove(paths[])`; DELETE em lote via `videos WHERE id IN
  (...)` (CASCADE limpa likes). Sem chunking (até 1000 itens) (depende
  de T201)
- [ ] T214 Configurar settings da Edge Function via tabela `app_settings`
  (migration `032_app_settings_for_edge_functions.sql`): criar tabela
  `app_settings(key text PK, value text, updated_at)` com RLS escopada
  para `service_role` + RPC `upsert_app_setting(p_key, p_value)`
  `SECURITY DEFINER` que só `service_role` pode executar. Inserir
  `edge_function_url` e `edge_function_key` via `service_role` no Studio
  ou via deploy script. **Mudança vs. plano original**: substituímos
  `ALTER DATABASE postgres SET app.edge_function_url = ...` por uma tabela
  porque (1) settings de banco não são gerenciáveis via migration sem
  acesso ao Postgres role superuser, (2) tabela permite rotacionar a key
  via UI/scripts sem precisar de superuser, (3) `enqueue_push_notification`
  e `cleanup_expired_videos` foram reescritos em `032_*.sql` para ler de
  `app_settings` ao invés de `current_setting('app.edge_function_url')`.
  (depende de T212, T213)

### Service Worker do client

- [ ] T215 Criar `public/sw.js` com listeners de `push` e `notificationclick`:
  `showNotification(title, { body, icon, badge, tag, data: { url } })` e
  `openWindow(data.url)` ao clicar. **Atenção**: arquivo MUST estar em
  `public/sw.js` (não em `src/`) para que o scope seja `/` e capture todas
  as rotas.
- [ ] T216 Criar `src/lib/pushHelpers.ts`: `urlBase64ToUint8Array(string)` e
  `arrayBufferToBase64(buffer)` (compatibilidade Web Push API)
- [ ] T217 Criar `src/lib/videoDuration.ts`:
  `getVideoDuration(file: File): Promise<number>` via `<video preload=metadata>`

**Checkpoint**: `supabase db push` aplica 020–030 sem erro; extensões
`pg_net` e `pg_cron` habilitadas; bucket `videos` visível no Studio;
Edge Functions ativas; SW carregado pelo client (DevTools → Application
→ Service Workers; verificar que `Scope: /`).

---

## Phase 3: User Story 1 — Publicar Vídeo (P1) 🎯

**Goal**: Usuário publica vídeo com título e categoria; vídeo aparece no feed.

**Independent Test**: Upload + INSERT + feed mostra o vídeo no topo.

### Testes críticos — US1 ⚠️

- [ ] T218 [P] [US1] Escrever testes em `tests/integration/feed.test.ts`:
  upload MP4 ≤ 30MB persiste em `videos/{user_id}/{uuid}.mp4`; INSERT em
  `videos` com `author_id` correto via RLS; rejeitar AVI (MIME) e > 30MB
  (Storage limit); título < 3 ou > 80 caracteres rejeitado pelo CHECK

### Implementação — US1

- [ ] T219 [P] [US1] Criar `src/services/feed.service.ts` com
  `publishVideo(file, title, category)` (validação client + upload Storage
  + INSERT, com rollback de Storage em caso de falha do INSERT)
- [ ] T220 [P] [US1] Criar `src/components/VideoUpload.tsx`: input file,
  preview `<video>`, validação (size, MIME, duração via `getVideoDuration`),
  callback `onSelected(file)`
- [ ] T221 [P] [US1] Criar `src/components/CategoryPicker.tsx`: dropdown
  com as 8 categorias usando `VIDEO_CATEGORY_LABEL` para display
- [ ] T222 [US1] Criar `src/screens/PublishVideoScreen.tsx`: integra
  `VideoUpload`, input de título, `CategoryPicker`, botão submit; loading
  com progress; toast de sucesso → navegar para `/feed` (depende de T219,
  T220, T221)
- [ ] T223 [US1] Adicionar rota `/feed/publish` em `src/router/index.tsx`
  protegida (depende de T222)

**Checkpoint**: usuário publica vídeo; aparece no Storage + DB; navegação
volta ao feed.

---

## Phase 4: User Story 2 — Visualizar Feed (P1) 🎯

**Goal**: Feed lista vídeos não-expirados ordenados por data DESC.

**Independent Test**: Com 3+ vídeos, abrir `/feed` mostra todos com player,
autor, contagem de likes.

### Testes críticos — US2 ⚠️

- [ ] T224 [US2] Escrever testes em `tests/integration/feed.test.ts`:
  `get_feed(20, 0)` retorna 20 vídeos não-expirados ordenados; vídeo com
  `expires_at < now()` NÃO aparece; `viewer_liked` é true quando o user
  atual já curtiu, false caso contrário; `like_count` retorna contagem real
  (não filtrada por RLS); `get_my_videos` inclui expirados do próprio user

### Implementação — US2

- [ ] T225 [P] [US2] Estender `src/services/feed.service.ts` com
  `getFeed(limit, offset)` chamando RPC; mapear `FeedItemRow → FeedItem`
  (com `author_avatar: string|null → authorAvatar?: string` via `?? undefined`)
- [ ] T226 [P] [US2] Criar `src/hooks/useFeed.ts`: paginação com
  `nextPage()`, estado `{ items, loading, hasMore }`, recarga automática
  (depende de T225)
- [ ] T227 [P] [US2] Criar `src/components/VideoCard.tsx`: player HTML5
  (`<video controls preload=metadata>` com `getPublicUrl(storagePath)`),
  avatar autor (usa componente Avatar da feature 002), nickname, data
  relativa (use `Intl.RelativeTimeFormat`), título, categoria,
  `LikeButton`, menu de 3 pontos (excluir se autor)
- [ ] T228 [US2] Criar `src/screens/FeedScreen.tsx`: lista vertical com
  `VideoCard`; `EmptyState` quando sem vídeos; scroll infinito (intersection
  observer no último card) (depende de T226, T227)
- [ ] T229 [US2] Adicionar rota `/feed` em `src/router/index.tsx`;
  ícone na NavBar (depende de T228)

**Checkpoint**: feed exibe vídeos com player funcional, autor, contagem de
curtidas; scroll infinito carrega mais.

---

## Phase 5: User Story 3 — Curtir/Descurtir (P2)

**Goal**: Toggle de like com optimistic UI e persistência privada.

**Independent Test**: Curtir incrementa contagem; descurtir decrementa;
estado persiste entre sessões; outros usuários não conseguem ver quem curtiu.

### Testes críticos — US3 ⚠️

- [ ] T230 [P] [US3] Escrever testes em `tests/integration/video-likes.test.ts`:
  INSERT em `video_likes` por user A incrementa contagem na RPC; DELETE
  decrementa; INSERT duplicado rejeitado por UNIQUE; user B fazendo
  `SELECT * FROM video_likes WHERE profile_id = A.id` retorna 0 linhas
  (RLS bloqueia — privacidade FR-011)

### Implementação — US3

- [ ] T231 [P] [US3] Estender `src/services/feed.service.ts` com
  `likeVideo(videoId)` e `unlikeVideo(videoId)`
- [ ] T232 [P] [US3] Criar `src/hooks/useVideoLike.ts`: estado local
  `{ liked, count }` por vídeo; `toggle()` aplica mudança otimista,
  reverte em erro (depende de T231)
- [ ] T233 [P] [US3] Criar `src/components/LikeButton.tsx`: ícone (coração
  vazio/cheio) + contagem; integra `useVideoLike` (depende de T232)
- [ ] T234 [US3] Integrar `LikeButton` no `VideoCard` substituindo o
  placeholder de T227 (depende de T233)

**Checkpoint**: curtir/descurtir funciona com feedback imediato; estado
persiste; privacidade preservada.

---

## Phase 6: User Story 4 — Excluir Próprio Vídeo (P2)

**Goal**: Autor exclui seu vídeo a qualquer momento; arquivo + linha são
removidos.

**Independent Test**: Autor exclui → vídeo some do feed para todos; arquivo
no Storage também sai.

### Testes críticos — US4 ⚠️

- [ ] T235 [US4] Escrever testes em `tests/integration/feed.test.ts`:
  DELETE em `videos` pelo autor sucede; CASCADE remove curtidas associadas;
  arquivo do Storage também é removido (verificar via Storage API).
  DELETE por não-autor é rejeitado pela RLS

### Implementação — US4

- [ ] T236 [US4] Estender `src/services/feed.service.ts` com
  `deleteVideo(videoId, storagePath)`: 2 chamadas sequenciais (Storage
  remove + DB delete), com tratamento de erro entre etapas (depende de T219)
- [ ] T237 [US4] Adicionar menu de 3 pontos no `VideoCard` com opção
  "Excluir" visível apenas quando `authorId === currentProfileId`;
  modal de confirmação; chamar `deleteVideo` ao confirmar; remover item da
  lista local após sucesso (depende de T236, T234)

**Checkpoint**: autor exclui vídeo; some do feed para todos; arquivo no
Storage é removido.

---

## Phase 7: User Story 5 — Ativar Notificações Push (P2)

**Goal**: Toggle no perfil ativa/desativa subscription Web Push.

**Independent Test**: Ligar toggle → permissão concedida → linha em
`push_subscriptions`. Desligar → linha removida + `unsubscribe()` no client.

### Testes críticos — US5 ⚠️

- [ ] T238 [P] [US5] Escrever testes em
  `tests/integration/push-subscriptions.test.ts`: INSERT em
  `push_subscriptions` por user A sucede; tentar INSERT com `profile_id`
  de B é rejeitado (RLS WITH CHECK); endpoint UNIQUE rejeita duplicata;
  DELETE remove apenas próprias linhas

### Implementação — US5

- [ ] T239 [P] [US5] Criar `src/services/push.service.ts` com
  `subscribe()` (registra SW, pede permissão, subscribe no PushManager,
  INSERT em `push_subscriptions`); `unsubscribe()` (DELETE da linha +
  `subscription.unsubscribe()`); `getStatus(): PushStatus` (depende de
  T215, T216)
- [ ] T240 [P] [US5] Criar `src/hooks/usePushSubscription.ts`: estado
  reativo de status; expõe `enable()`/`disable()` (depende de T239)
- [ ] T241 [P] [US5] Criar `src/components/PushToggle.tsx`: switch ON/OFF
  com tooltip explicativo quando desabilitado (browser não suporta ou
  permissão negada) (depende de T240)
- [ ] T242 [US5] Integrar `PushToggle` em `src/screens/ProfileScreen.tsx`
  abaixo dos stats; toast de erro quando permission denied
  (depende de T241)

**Checkpoint**: toggle ativa subscription; visível na tabela `push_
subscriptions`; ao desligar a subscription é removida.

---

## Phase 8: User Story 6 — Receber Push em Eventos (P2)

**Goal**: Os 3 eventos disparam push (partida e ranking via chamadas
explícitas no `register_match` v3; liga via trigger AFTER INSERT).

**Independent Test**: Disparar cada evento → push chega ao SO; clique abre
URL correta.

### Testes críticos — US6 ⚠️

- [ ] T243 [P] [US6] Escrever testes em `tests/integration/push-triggers.test.ts`:
  - **Partida**: chamar `register_match` com user A como participante e B
    como criador → `enqueue_push_notification` foi chamada para A
    (verificar via mock ou `net.http_request_queue`); A SEM subscription
    → nenhuma chamada HTTP
  - **Ranking ≥ 3**: cenário seedado com 10 jogadores; A na posição 10
    com 1000 pts. Registrar 3 partidas onde A ganha e jogadores acima
    perdem → A sobe ≥ 3 posições → push de ranking disparado
  - **Ranking < 3**: A sobe apenas 1 posição → push de ranking NÃO
    disparado
  - **Liga**: INSERT em `league_players` por não-dono dispara
    `enqueue_push_notification` para o adicionado; `create_league`
    (autoadição do dono) NÃO dispara
  - **Sem subscription**: `enqueue_push_notification` filtra perfis sem
    subscription antes de chamar HTTP — array vazio = sem chamada
- [ ] T244 [P] [US6] Escrever teste em `tests/integration/push-triggers.test.ts`:
  Edge Function `send-push-notification` retorna 401 sem header
  Authorization correto; retorna 200 e remove subscription expirada quando
  Mozilla/FCM responde 410 (simular via mock); `profile_ids: []` retorna
  `{sent:0, dead:0}` sem erro (guard)

### Implementação — US6

> A lógica de push já está em T208 (register_match v3) e T209 (trigger de
> liga). Edge Function em T212. Esta fase valida integração e adiciona logs.

- [ ] T245 [US6] Validar integração end-to-end no ambiente local:
  - Disparar `register_match` → ver chamada em `net.http_request_queue`
  - Edge Function recebe payload → envia via `webpush.sendNotification`
  - Browser exibe a notificação (DevTools → Application → Notifications)
- [ ] T246 [US6] Adicionar log estruturado nas funções SECURITY DEFINER
  (`RAISE NOTICE`) para facilitar debug em produção (volume de notificações
  por evento, perfis sem subscription, etc)

**Checkpoint**: cada um dos 3 eventos dispara push; subscription expirada
é removida automaticamente; ranking só notifica quando o jogador
**participou** da partida que causou a mudança (não dispara para terceiros).

---

## Phase 9: Polish

- [ ] T247 [P] Adicionar skeleton de loading em `FeedScreen` enquanto
  carrega a primeira página
- [ ] T248 [P] Adicionar `EmptyState` em `FeedScreen` quando sem vídeos
  ("Nenhuma jogada ainda — seja o primeiro!") com CTA para `/feed/publish`
- [ ] T249 [P] Adicionar mensagens de erro consistentes com FR-012 em
  todos os formulários da feature
- [ ] T250 Validar player de vídeo em Chrome DevTools mobile (390 px):
  controles touch-friendly, fullscreen funciona, aspect-ratio preservado
- [ ] T251 Validar performance do feed com 100 vídeos seedados:
  scroll suave, vídeos pausam ao sair da viewport (`IntersectionObserver` +
  `video.pause()`), mediar SC-002 (< 2s primeira página)
- [ ] T252 Validar fluxo completo de push no celular real:
  ativar push no Android Chrome → registrar partida em outro browser →
  notificação chega no SO → clique abre o app na URL correta. Mensurar
  SC-003 (< 10s) e SC-005 (subscription expirada removida na primeira
  tentativa que recebe 410/404).
- [ ] T253 Documentar fluxo de geração e rotação das VAPID keys no
  `docs/SECURITY.md` (ou README). Garantir que ninguém comita a private key.
- [ ] T254 Validar cron de retenção: criar vídeo com `expires_at = now()`,
  rodar `SELECT cleanup_expired_videos()`, confirmar que arquivo do Storage
  some e linha em `videos` é removida via Edge Function `cleanup-video`
  (verificar logs)

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 2 (Foundational) ← BLOQUEIA tudo abaixo
    ├── Phase 3 (US1 — P1) 🎯 Publicar
    │       └── Phase 4 (US2 — P1) 🎯 Feed [depende de US1 para ter dados]
    │               └── Phase 5 (US3 — P2) Curtir [usa VideoCard de US2]
    │               └── Phase 6 (US4 — P2) Excluir [usa VideoCard de US2]
    └── Phase 7 (US5 — P2) Ativar Push
            └── Phase 8 (US6 — P2) Receber Push [register_match v3 em T208]
                    └── Phase 9 (Polish)
```

### User Story Dependencies

| Story | Depende de | Pode começar após |
|-------|------------|-------------------|
| US1 (P1) Publicar | Phase 2 (T202, T205, T211) | T217 (último item de Phase 2) |
| US2 (P1) Feed | Phase 2 (T206) + US1 para dados | T223 |
| US3 (P2) Curtir | US2 (VideoCard) | T229 |
| US4 (P2) Excluir | US2 (VideoCard) + US3 (menu integrado) | T234 |
| US5 (P2) Ativar push | Phase 2 (T215, T216) | T217 |
| US6 (P2) Receber push | Phase 2 (T208, T209, T212) + US5 | T242 |

### Parallel Opportunities

- **Foundational**: T201, T202a sequenciais (extensões antes de tudo);
  T202–T204 paralelas após T202a; T205 depende de T202+T203+T204; T206
  depende de T205; T207 depende de T202a+T204; T208 e T209 dependem de T207;
  T210 depende de T202a+T205; T211 depende de T202; T212, T213 paralelos
  após T201; T215–T217 paralelos
- **US1** (T218–T221): paralelos; T222 depende de T219+T220+T221
- **US2** (T225–T227): paralelos; T228 depende de T226+T227
- **US3** (T231–T233): paralelos; T234 integra em T233
- **US5** (T239–T241): paralelos; T242 integra
- **US6** (T243, T244): paralelos
- **Polish** (T247–T249): paralelos

---

## Implementation Strategy

### Entrega incremental

1. Phase 2 (Foundational) → fundação completa
2. Phase 3 + Phase 4 (US1 + US2) → feed funcional (publica + visualiza) → deploy
3. Phase 5 + Phase 6 (US3 + US4) → engajamento (curtir + excluir) → deploy
4. Phase 7 (US5) → push ativável (sem evento ainda)
5. Phase 8 (US6) → push recebido → **feature 003 completa** → deploy
6. Phase 9 (Polish) → release

### MVP da feature (entrega mínima)

- Phase 2 + Phase 3 + Phase 4 → feed básico (publicação + visualização)
- US3/US4/US5/US6 são incrementais

> **Recomendação**: validar Phase 3+4 com 5–10 usuários reais antes de
> investir em push (mais complexo de testar e debugar).

### Sobre a substituição do `register_match` (feature 002 → 003)

A migration T208 **substitui** o `register_match` v2 criado na feature 002
por uma v3 que adiciona as chamadas explícitas de push ao final. Isso
significa que **a feature 003 só pode ser implantada DEPOIS** da feature
002 (ou em conjunto). Se for implantada antes, a v3 referencia tabelas
(`leagues`, `match_leagues`, `match_league_players`) que não existem.

---

## Notes

- `[P]` = arquivos diferentes, sem dependência entre tarefas
- Mesmo padrão dos specs 001 e 002: testes falham antes de implementar
- Edge Functions são testáveis localmente via `supabase functions serve`
- VAPID keys devem ficar em gestor de senhas — nunca em git
- Push em iOS requer PWA instalado ("Adicionar à tela inicial") + iOS 16.4+
- Retenção de 60 dias é fixa no MVP; configurável é pós-feature
- Push de partida e ranking saem do **próprio `register_match` v3**, não
  de triggers granulares — evita inconsistências causadas por updates em
  loop de 4 jogadores na mesma transação

---

**Total**: 54 tasks · **Foundational**: 17 (T201, T202a, T202–T217) ·
**US1**: 6 (T218–T223) · **US2**: 6 (T224–T229) · **US3**: 5 (T230–T234) ·
**US4**: 3 (T235–T237) · **US5**: 5 (T238–T242) · **US6**: 4 (T243–T246) ·
**Polish**: 8 (T247–T254)
