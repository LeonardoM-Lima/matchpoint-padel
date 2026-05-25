# Feature Specification: Feed de Jogadas e Notificações Push

**Feature Branch**: `003-feed-e-push`
**Created**: 2026-05-22
**Status**: Draft
**Input**: User description: "Feed de vídeos curtos de jogadas + notificações push para eventos relevantes"

## Clarifications

### Session 2026-05-22

- Q: Onde armazenar os vídeos? → A: Supabase Storage (já integrado, free tier 1GB suficiente para validação).
- Q: Limite de tamanho/duração? → A: 30 segundos, máximo 30MB por vídeo.
- Q: Quem pode excluir? → A: Autor a qualquer momento; sistema apaga automaticamente após 2 meses (job pg_cron).
- Q: Como funciona a retenção? → A: Apagar arquivo do Storage + linha no banco (CASCADE em curtidas).
- Q: Categorias disponíveis? → A: 8 categorias técnicas: Smash, Bandeja, Víbora, Saque, Tombo, Furada, Engraçado, Outras.
- Q: Curtidas são públicas? → A: Não. Apenas contagem agregada. Quem curtiu permanece privado.
- Q: Provider de push? → A: Web Push API + VAPID (browser nativo via Service Worker, sem provider externo).
- Q: Onde a lógica de envio roda? → A: Supabase Edge Functions chamadas por triggers no Postgres via pg_net.
- Q: Quais eventos disparam push? → A: 3 eventos: partida registrada com você (US4 do MVP), mudança significativa de posição no ranking, convite/adição em liga privada.
- Q: Preferências de notificação? → A: Toggle global único — ligado ativa todos os 3 eventos.
- Q: Quando uma notificação é descartada/lida, fica registrada? → A: Não no MVP da feature. Push é fire-and-forget; histórico de notificações fica fora de escopo.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Publicar Vídeo de Jogada (Priority: P1) 🎯

Como jogador autenticado, quero publicar um vídeo curto de uma jogada minha
com título e categoria para compartilhar com a comunidade.

**Why this priority**: É o coração do feed — sem publicação não há feed.
Validar a UX de upload antes de qualquer outra feature.

**Independent Test**: Usuário seleciona um vídeo de até 30s e 30MB, define
título e categoria, publica — o vídeo aparece no topo do feed para todos os
usuários autenticados.

**Acceptance Scenarios**:

1. **Given** um jogador autenticado, **When** seleciona um vídeo MP4/MOV/WebM
   de até 30s e 30MB, informa um título (3–80 caracteres) e categoria,
   **Then** o vídeo é enviado ao Storage, registrado em `videos` e exibido
   no topo do feed em até 5 segundos.
2. **Given** um jogador autenticado, **When** tenta enviar vídeo > 30MB ou
   duração > 30s, **Then** o sistema rejeita com mensagem clara antes do
   upload (validação no client).
3. **Given** um jogador autenticado, **When** envia vídeo em formato não
   suportado (ex: AVI, FLV), **Then** o sistema rejeita com mensagem
   "Formato deve ser MP4, MOV ou WebM".
4. **Given** um jogador autenticado, **When** envia vídeo sem título,
   **Then** o sistema rejeita com mensagem "Informe um título para a jogada".

---

### User Story 2 - Visualizar Feed de Jogadas (Priority: P1) 🎯

Como jogador autenticado, quero abrir o feed e ver os vídeos publicados pela
comunidade, ordenados do mais recente para o mais antigo.

**Why this priority**: É a contraparte de US1. Sem visualização, ninguém vê
o que foi publicado. Os dois P1 viabilizam o uso mínimo do feed.

**Independent Test**: Com 3+ vídeos publicados, abrir o feed lista todos
ordenados por `created_at DESC` com player de vídeo funcional, foto do autor,
nome, data e contagem de curtidas.

**Acceptance Scenarios**:

1. **Given** um jogador autenticado, **When** abre a tela "Feed", **Then**
   vê uma lista de vídeos ordenada por data de publicação (mais recente
   primeiro), cada item exibindo: vídeo (player nativo), avatar do autor,
   nickname, data relativa (ex: "há 2 horas"), título, categoria e contagem
   de curtidas.
2. **Given** o feed não tem nenhum vídeo, **When** o usuário abre a tela,
   **Then** vê um estado vazio com mensagem incentivando a publicar
   ("Nenhuma jogada ainda — seja o primeiro!") e botão "Publicar vídeo".
3. **Given** o usuário rola o feed, **When** atinge o fim da página inicial
   (20 vídeos), **Then** carrega automaticamente os próximos 20 (scroll
   infinito).
4. **Given** o vídeo do autor já expirou (job de exclusão rodou), **When**
   o feed é carregado, **Then** o vídeo não aparece na listagem.

---

### User Story 3 - Curtir/Descurtir Vídeo (Priority: P2)

Como jogador autenticado, quero curtir vídeos que gostei para incentivar o
autor; quero também poder remover a curtida se mudei de ideia.

**Why this priority**: Aumenta engajamento e dá feedback ao autor, mas não é
necessário para o uso mínimo (P1 publica + visualiza).

**Independent Test**: Tocar no ícone de curtir incrementa a contagem em +1
imediatamente (otimista); tocar novamente decrementa em -1. Estado persiste
entre sessões.

**Acceptance Scenarios**:

1. **Given** um jogador autenticado vendo o feed, **When** toca no botão de
   curtir em um vídeo que ainda não curtiu, **Then** o ícone fica preenchido
   e a contagem incrementa em +1 imediatamente; persistência ocorre em
   background.
2. **Given** um jogador autenticado já curtiu um vídeo, **When** toca
   novamente no botão de curtir, **Then** o ícone volta ao estado vazio e a
   contagem decrementa em -1.
3. **Given** um jogador autenticado, **When** abre o feed, **Then** vídeos
   que ele já curtiu aparecem com o botão preenchido (estado persistido).
4. **Given** o usuário curte e descurte rapidamente, **When** o request
   falha (rede), **Then** o estado visual reverte e exibe toast de erro
   discreto.

---

### User Story 4 - Excluir Próprio Vídeo (Priority: P2)

Como autor de um vídeo, quero excluí-lo a qualquer momento se mudei de ideia
ou postei errado.

**Why this priority**: Controle sobre conteúdo próprio é requisito básico de
moderação por autor. Não bloqueia o fluxo principal.

**Independent Test**: Autor abre seu próprio vídeo, clica em "Excluir",
confirma — o vídeo some do feed para todos os usuários; arquivo é removido
do Storage; curtidas são deletadas via CASCADE.

**Acceptance Scenarios**:

1. **Given** um jogador é autor de um vídeo, **When** abre o card no feed
   e clica em "Excluir" (menu de 3 pontos), **Then** sistema pede confirmação
   antes de excluir.
2. **Given** o autor confirma a exclusão, **When** a operação completa,
   **Then** o vídeo some do feed em até 3 segundos e o arquivo é removido do
   Storage.
3. **Given** um jogador NÃO é autor do vídeo, **When** abre o card,
   **Then** o menu de 3 pontos não exibe a opção "Excluir".

---

### User Story 5 - Ativar Notificações Push (Priority: P2)

Como jogador autenticado, quero ativar notificações push pelo perfil para ser
notificado quando eventos relevantes acontecem mesmo com o app fechado.

**Why this priority**: É a porta de entrada de todas as outras notificações.
Sem opt-in, nenhuma notificação é enviada.

**Independent Test**: Tela de perfil tem um toggle "Notificações push";
ligá-lo pede permissão ao browser, registra a subscription e a partir desse
momento o usuário recebe pushes para os 3 eventos especificados.

**Acceptance Scenarios**:

1. **Given** um jogador autenticado, **When** acessa o perfil e ativa o
   toggle "Notificações push", **Then** o browser pede permissão de
   notificação; ao conceder, o sistema registra a subscription em
   `push_subscriptions`.
2. **Given** o usuário negou a permissão do browser, **When** tenta ativar,
   **Then** o toggle permanece desligado e o sistema exibe mensagem
   "Permissão negada nas configurações do navegador. Habilite para receber
   notificações.".
3. **Given** o usuário tem notificações ativas, **When** desliga o toggle,
   **Then** o sistema remove a subscription do banco e o navegador para de
   receber push.
4. **Given** o browser não suporta Web Push (ex: iOS < 16.4), **When** o
   usuário abre o perfil, **Then** o toggle aparece desabilitado com tooltip
   "Seu navegador não suporta notificações push".

---

### User Story 6 - Receber Push em Eventos Relevantes (Priority: P2)

Como jogador com push ativo, quero receber notificações quando:
1. Outro jogador registra uma partida em que sou participante.
2. Subo ou caio 3+ posições no ranking global.
3. Sou adicionado a uma liga privada por outro jogador.

**Why this priority**: É o valor entregue ao usuário pelas notificações.
Cada evento traz o usuário de volta ao app.

**Independent Test**: Com push ativo, disparar cada um dos 3 eventos
(via teste integrado ou manual) — o usuário recebe uma notificação no SO
com título e ação que leva à tela relevante.

**Acceptance Scenarios**:

1. **Given** o jogador A tem push ativo, **When** o jogador B registra uma
   partida incluindo A entre os 4 jogadores, **Then** A recebe push:
   título "Nova partida registrada", corpo "Você ganhou/perdeu X pontos",
   clique abre `/profile/history`.
2. **Given** o jogador A tem push ativo e estava em posição 10 no ranking,
   **When** após uma partida A sobe para a posição 7, **Then** A recebe push:
   título "Você subiu no ranking", corpo "De 10º para 7º — parabéns!".
3. **Given** o jogador A tem push ativo, **When** o dono de uma liga B adiciona
   A à liga, **Then** A recebe push: título "Convite para liga", corpo
   "Você foi adicionado à liga 'Nome da Liga'", clique abre `/leagues/{id}`.
4. **Given** o jogador A NÃO tem push ativo, **When** qualquer um dos 3
   eventos ocorre, **Then** A não recebe push (e nenhum erro é exibido no
   sistema).

---

### Edge Cases

- Upload de vídeo durante perda de rede → exibir progress; em caso de falha,
  permitir retry sem reabrir o seletor de arquivo.
- Vídeo corrompido / sem stream de vídeo → rejeitar no client (validação via
  `<video>` element) com mensagem genérica.
- Vídeo que excede 30s sendo enviado por contornar a validação client →
  rejeitado pelo bucket (limite de tamanho 30MB já reduz isso, mas duração
  exata não é validada no Storage — autor pode subir vídeo de 60s desde que
  < 30MB; isso é aceito como compromisso no MVP da feature).
- Curtir vídeo que foi excluído entre o load e o tap → request falha
  silenciosamente; UI reverte estado.
- Push enviado para subscription expirada (browser revogou) → Edge Function
  detecta resposta 410/404 do servidor de push e remove a subscription do
  banco.
- Usuário adicionado a liga por um dono não envia push se o adicionado
  desativou notificações.
- Mudança no ranking de < 3 posições não dispara push (evita spam).
- Múltiplas mudanças seguidas no ranking (várias partidas em sequência) →
  cada uma dispara push independente; futuramente pode ser agregado.

## Requirements *(mandatory)*

### Functional Requirements

#### Feed de Jogadas

- **FR-001**: Sistema MUST permitir a qualquer jogador autenticado publicar
  um vídeo com `title` (3–80 caracteres) e `category` (enum).
- **FR-002**: Vídeo MUST estar nos formatos MP4, MOV ou WebM, com tamanho
  máximo de 30MB. Sistema MUST rejeitar uploads fora desses critérios.
- **FR-003**: Sistema SHOULD validar duração ≤ 30s no client antes do upload
  (via `<video>.duration`). Vídeos mais longos com tamanho ≤ 30MB são aceitos
  no MVP (compromisso documentado).
- **FR-004**: A categoria do vídeo MUST ser um dentre 8 valores
  enumerados (valores em ASCII no banco; labels humanizados no client):
  - `smash`     → "Smash"
  - `bandeja`   → "Bandeja"
  - `vibora`    → "Víbora"
  - `saque`     → "Saque"
  - `tombo`     → "Tombo"
  - `furada`    → "Furada"
  - `engracado` → "Engraçado"
  - `outras`    → "Outras"

  Campo obrigatório.
- **FR-005**: Cada vídeo MUST armazenar: `id`, `author_id`, `title`,
  `category`, `storage_path` (path no bucket), `created_at`,
  `expires_at` (= `created_at + INTERVAL '60 days'`).
- **FR-006**: O feed MUST listar vídeos onde `expires_at > now()`, ordenados
  por `created_at DESC`. Paginação em páginas de 20 vídeos (scroll infinito
  ou "carregar mais").
- **FR-007**: Cada item do feed MUST exibir: vídeo (player HTML5 nativo),
  avatar do autor, nickname do autor, data relativa, título, categoria e
  contagem de curtidas.
- **FR-008**: Sistema MUST permitir ao autor excluir seu próprio vídeo a
  qualquer momento. Exclusão remove a linha em `videos` e o arquivo no
  Storage. Curtidas associadas vão embora via CASCADE.
- **FR-009**: Job automatizado MUST remover vídeos com `expires_at <= now()`
  diariamente. Remoção inclui o arquivo no Storage e a linha em `videos`
  (CASCADE para `video_likes`).
- **FR-010**: Sistema MUST permitir ao usuário autenticado curtir/descurtir
  cada vídeo. Cada par (`user`, `video`) tem 0 ou 1 curtida (UNIQUE).
- **FR-011**: A contagem de curtidas exibida MUST ser agregada — quem curtiu
  permanece privado (RLS impede SELECT de `video_likes` para outros usuários,
  exceto para descobrir se o próprio usuário curtiu).
- **FR-012**: Sistema MUST exibir as mensagens de erro:
  - Vídeo > 30MB: "Vídeo deve ter até 30MB"
  - Formato inválido: "Formato deve ser MP4, MOV ou WebM"
  - Duração > 30s (quando detectável): "Vídeo deve ter até 30 segundos"
  - Título inválido: "Título deve ter entre 3 e 80 caracteres"
  - Falha no upload: "Não foi possível enviar o vídeo. Tente novamente."
  - Falha ao excluir: "Não foi possível excluir o vídeo. Tente novamente."

#### Notificações Push

- **FR-013**: Sistema MUST oferecer um toggle global "Notificações push" no
  perfil do usuário. Estado padrão: desligado.
- **FR-014**: Ao ativar o toggle, sistema MUST pedir permissão ao navegador
  via `Notification.requestPermission()` e, se concedida, registrar a Web
  Push subscription em `push_subscriptions` (endpoint + keys p256dh e auth).
- **FR-015**: Ao desligar o toggle, sistema MUST remover a subscription do
  banco e chamar `subscription.unsubscribe()` no client.
- **FR-016**: Navegadores sem suporte a Web Push MUST exibir o toggle
  desabilitado com tooltip explicativo. Detecção via
  `'serviceWorker' in navigator && 'PushManager' in window`.
- **FR-017**: Sistema MUST disparar push quando:
  - **FR-017a**: Uma partida é registrada com o usuário como participante
    (`match_players.profile_id = user.profile_id`) e ele NÃO é o criador.
  - **FR-017b**: A posição do usuário no ranking global muda em 3 ou mais
    posições (subindo ou descendo) após uma partida.
  - **FR-017c**: O usuário é adicionado a uma liga privada
    (insert em `league_players`) por outro jogador (`profile_id != owner_id`
    OU `profile_id != adder_id`).
- **FR-018**: O envio de push MUST ser feito por uma Supabase Edge Function
  invocada por triggers no Postgres via `pg_net.http_post`. A função roda
  com privilégios `service_role` para acessar as subscriptions.
- **FR-019**: Quando o servidor de push (FCM/Mozilla/Apple) responde com
  status 404 ou 410 (subscription expirada/inválida), a Edge Function MUST
  remover a subscription do banco automaticamente.
- **FR-020**: Cada notificação push MUST conter: `title`, `body`, `icon`
  (logo do app), `tag` (deduplicação) e `data.url` (rota para abrir ao
  clicar).
- **FR-020a**: A `tag` MUST seguir as convenções abaixo, escolhidas para
  controlar deduplicação de forma adequada por tipo de evento:
  - Partida: `match-{match_id}-{profile_id}` — única por participante por
    partida; impede que múltiplos disparos da mesma partida virem 2
    notificações para o mesmo user, mas permite uma notificação por
    participante.
  - Ranking: `ranking-{profile_id}-{match_id}` — uma notificação por
    jogador por partida que causou a mudança; partidas subsequentes geram
    novas notificações (não substitui notificação anterior pendente).
  - Liga: `league-{league_id}-{profile_id}` — única por liga por usuário;
    se for re-adicionado, substitui notificação anterior.
  Por padrão do Web Push, notificações com a mesma `tag` no mesmo device
  **substituem** a anterior ainda visível (não empilham).
- **FR-021**: Usuário sem push ativo NÃO recebe nenhuma notificação — nenhum
  erro é exibido no sistema quando o evento ocorre.
- **FR-022**: Sistema MUST suportar múltiplas subscriptions por usuário
  (mesmo user em dispositivos diferentes — cada device gera uma subscription
  distinta).

### Key Entities *(include if feature involves data)*

- **Video**: Vídeo publicado por um jogador. Atributos: `id`, `author_id`
  (FK→profiles), `title`, `category` (enum), `storage_path`, `created_at`,
  `expires_at` (= created_at + 60 days).
- **VideoLike**: Curtida de um usuário em um vídeo. Atributos: `id`,
  `video_id` (FK CASCADE), `profile_id` (FK), `created_at`. Único por
  (`video_id`, `profile_id`).
- **PushSubscription**: Subscription de Web Push registrada por um usuário
  em um dispositivo. Atributos: `id`, `profile_id` (FK), `endpoint` (URL
  única do servidor de push), `p256dh`, `auth` (keys de criptografia),
  `user_agent`, `created_at`. Único por `endpoint`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 90% dos uploads de vídeos válidos (MP4/MOV/WebM ≤ 30MB)
  concluem em menos de 15 segundos em conexão 4G estável.
- **SC-002**: Feed carrega os primeiros 20 vídeos em menos de 2 segundos
  após abrir a tela em 4G estável.
- **SC-003**: 95% das notificações push enviadas pela Edge Function chegam
  ao dispositivo do usuário em menos de 10 segundos após o evento.
- **SC-004**: Job de retenção (pg_cron) executa em menos de 30 segundos
  diários para uma base de até 1000 vídeos expirando.
- **SC-005**: Subscription expirada (410/404) é removida do banco na
  **mesma execução** da Edge Function que detectou a falha — não há
  intervalo entre detecção e remoção. Validável via teste de integração
  que simula resposta 410 e verifica que a linha desaparece imediatamente
  após o `await Promise.allSettled`.

## Assumptions

- Vídeos são públicos para todos os usuários autenticados — sem privacidade
  por liga ou amigos no MVP da feature.
- O bucket `videos` é configurado como público para leitura. A
  imprevisibilidade do path (UUID v4 + UUID v4) torna enumeração inviável,
  mas URLs vazadas (compartilhamento externo, screenshots) permanecem
  acessíveis até a expiração ou exclusão. Mitigação via signed URLs é
  postergada — aceito como compromisso explícito do MVP.
- Não há transcodificação server-side. O vídeo é exibido como uploaded —
  navegadores modernos lidam com MP4/MOV/WebM nativamente.
- O autor é responsável por moderar o conteúdo que publica; não há sistema
  de denúncia no MVP da feature (fica para iteração futura).
- Retenção de 60 dias é fixa e não configurável pelo usuário.
- VAPID keys são geradas uma única vez e ficam configuradas como secrets
  do Supabase Edge Functions (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`).
- A `VAPID_PUBLIC_KEY` também é exposta como variável pública no client
  (necessária para subscribe).
- Mensagens de push são em português pt-BR (idioma único do app).

## Out of Scope (esta feature)

- Voto/ranking de vídeos (apenas curtida no MVP da feature).
- Comentários em vídeos.
- Compartilhamento externo (WhatsApp, Instagram).
- Seguir outros jogadores / feed personalizado por seguidos.
- Filtro do feed por categoria, autor, ranking.
- Denúncia de conteúdo inadequado.
- Notificações in-app (badge, central de notificações) — apenas push do SO.
- Histórico de notificações recebidas.
- Push para liga: convite "para aceitar" (no MVP da liga é adição direta).
- Push para eventos de leaderboard global (ex: "novo top 1").
- Análise de vídeo com IA (categorização automática, replay).
- Configuração granular de notificações (toggle por tipo).
- Notificações em horário noturno desabilitadas (quiet hours).
