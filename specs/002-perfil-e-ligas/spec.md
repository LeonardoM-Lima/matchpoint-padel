# Feature Specification: Perfil e Ligas Privadas

**Feature Branch**: `002-perfil-e-ligas`
**Created**: 2026-05-22
**Status**: Draft
**Input**: User description: "Edição de perfil (nome, foto, categoria) + Ligas privadas com ranking isolado por liga"

## Clarifications

### Session 2026-05-22

- Q: Como o jogador é adicionado a uma liga privada? → A: Dono adiciona manualmente buscando pelo nickname; jogador não precisa aceitar.
- Q: Como a partida é vinculada à liga? → A: Toggle/select opcional na tela de registrar partida; dropdown lista apenas ligas onde TODOS os 4 jogadores participam. Sem vínculo = só ranking global.
- Q: Como é feito o upload de foto de perfil? → A: Upload via Supabase Storage (limite 2MB, JPG/PNG/WebP, redimensionado para 256×256).
- Q: A categoria do perfil substitui o nível calculado por pontos? → A: Não. Categoria é informativa (auto-declarada, ex: 1ª, 2ª, 3ª, Open). Coexiste com o nível (Iniciante/Amador/Avançado) calculado pelo Elo.
- Q: Liga privada tem limite de participantes? → A: Não há limite.
- Q: Como funciona o ranking dentro da liga? → A: Liga é um ranking isolado começando todos com 0 pontos. Variação Elo calculada normalmente conta para a liga E para o ranking global simultaneamente.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Editar Perfil Pessoal (Priority: P1) 🎯

Como jogador autenticado, quero editar meu nome, foto e categoria do perfil para
personalizar como apareço para outros jogadores no app.

**Why this priority**: É a base de personalização do app. Foto e categoria são
identidade visual recorrente no ranking, matchmaking e ligas. Sem isso, todos os
jogadores parecem genéricos.

**Independent Test**: Usuário acessa perfil, clica em "Editar perfil", altera
nome, faz upload de foto e seleciona categoria — todas as alterações persistem
e refletem nas demais telas (ranking, matchmaking, histórico).

**Acceptance Scenarios**:

1. **Given** um jogador autenticado, **When** clica em "Editar perfil" e altera
   o nickname para um valor não vazio com 2–30 caracteres, **Then** o nickname
   novo aparece imediatamente no perfil, ranking, matchmaking e histórico.
2. **Given** um jogador autenticado, **When** faz upload de uma imagem JPG/PNG/WebP
   de até 2MB, **Then** o sistema redimensiona para 256×256, persiste no Storage
   e exibe a foto no avatar em todas as telas.
3. **Given** um jogador autenticado, **When** seleciona uma categoria
   (1ª, 2ª, 3ª, 4ª, 5ª, 6ª, Open, Iniciante), **Then** a categoria fica visível
   no perfil e como badge informativo nos cards de matchmaking e ranking.
4. **Given** um jogador sem foto, **When** abre qualquer tela com avatar,
   **Then** vê o avatar com iniciais já existente (fallback).
5. **Given** um jogador autenticado, **When** envia foto maior que 2MB ou em
   formato não suportado, **Then** o sistema rejeita com mensagem
   "Foto deve ser JPG, PNG ou WebP com até 2MB".

---

### User Story 2 - Criar Liga Privada (Priority: P2)

Como jogador autenticado, quero criar uma liga privada com nome e foto de capa
para organizar partidas e ranking com um grupo específico (amigos, time da
academia, condomínio).

**Why this priority**: Liga é um espaço social que aumenta retenção. Sem criar
a liga, nenhuma das funcionalidades subsequentes (adicionar membros, vincular
partidas) é desbloqueada.

**Independent Test**: Usuário cria uma liga, define nome e foto de capa — a
liga aparece imediatamente na tela "Minhas Ligas" com o jogador como dono e
único participante.

**Acceptance Scenarios**:

1. **Given** um jogador autenticado, **When** acessa "Minhas Ligas" e clica em
   "Criar nova liga", informa nome (3–40 caracteres) e foto de capa (até 2MB),
   **Then** a liga é criada com o jogador como dono e como único participante
   (com 0 pontos na liga).
2. **Given** um jogador é dono de uma liga, **When** acessa a tela da liga,
   **Then** vê o nome, foto de capa, lista de participantes e ranking interno
   (apenas ele com 0 pontos inicialmente).
3. **Given** um jogador não é dono nem participante de uma liga, **When** tenta
   abrir essa liga via URL direta, **Then** o sistema bloqueia o acesso com
   mensagem "Você não faz parte desta liga".
4. **Given** um jogador é dono de uma liga, **When** clica em "Excluir liga" e
   confirma, **Then** a liga e todos os registros de participação/ranking
   internos são removidos; partidas vinculadas permanecem registradas
   (com vínculo removido para a liga inexistente).

---

### User Story 3 - Adicionar e Remover Participantes (Priority: P2)

Como dono de uma liga privada, quero adicionar e remover participantes pelo
nickname para controlar quem participa do ranking interno.

**Why this priority**: Sem participantes, a liga não tem propósito. Adição
manual é o mecanismo escolhido (sem convite por link no MVP da feature).

**Independent Test**: Dono busca um jogador pelo nickname, adiciona à liga —
o jogador adicionado vê a liga em "Minhas Ligas" e aparece no ranking interno
com 0 pontos. Dono também consegue remover o participante.

**Acceptance Scenarios**:

1. **Given** um jogador é dono de uma liga, **When** busca outro jogador pelo
   nickname e clica em "Adicionar à liga", **Then** o jogador é adicionado com
   0 pontos na liga e a liga passa a aparecer em "Minhas Ligas" para ele.
2. **Given** um jogador não é dono da liga, **When** tenta adicionar alguém,
   **Then** o sistema bloqueia com erro "Apenas o dono pode adicionar membros".
3. **Given** um jogador já é participante de uma liga, **When** o dono tenta
   adicioná-lo novamente, **Then** o sistema rejeita com mensagem
   "Jogador já participa desta liga".
4. **Given** um dono remove um participante (incluindo a si mesmo, exceto se
   for o único participante), **When** confirma a remoção, **Then** o
   participante é removido do ranking interno; suas partidas vinculadas
   permanecem registradas (sem reversão de pontos).
5. **Given** o dono tenta sair da própria liga e ele é o único participante,
   **When** confirma, **Then** o sistema sugere excluir a liga ao invés de
   "sair" (já que ela ficaria sem dono).

---

### User Story 4 - Registrar Partida Vinculada a uma Liga (Priority: P1) 🎯

Como jogador autenticado, quero opcionalmente vincular uma partida a uma liga
privada no momento do registro para que os pontos contem para o ranking interno
da liga além do global.

**Why this priority**: É o coração da integração — sem isso, ligas viram apenas
listas sem competição real. Mantém o fluxo de registro em uma tela única
(decisão de UX: não duplicar telas de criação).

**Independent Test**: Usuário registra partida com 4 jogadores que pertencem
todos à mesma liga, seleciona a liga no dropdown — os pontos da partida são
aplicados tanto ao ranking global quanto ao ranking interno da liga.

**Acceptance Scenarios**:

1. **Given** os 4 jogadores selecionados para uma partida pertencem todos a uma
   mesma liga X, **When** o jogador abre o dropdown "Vincular a uma liga",
   **Then** a liga X aparece como opção (junto com outras ligas em que todos
   participem).
2. **Given** ao menos um dos 4 jogadores não pertence à liga X, **When** o
   jogador abre o dropdown, **Then** a liga X NÃO aparece como opção.
3. **Given** o usuário vincula a partida à liga X e o placar é válido,
   **When** o registro é confirmado, **Then** o sistema aplica a variação de
   pontos para os 4 jogadores no ranking global (em `profiles.points`) E no
   ranking interno da liga X (em `league_players.points`).
4. **Given** o usuário não vincula nenhuma liga (deixa em "Nenhuma"),
   **When** o registro é confirmado, **Then** o sistema aplica a variação de
   pontos apenas no ranking global — nenhuma liga é afetada.
5. **Given** a partida foi excluída dentro da janela de 5 minutos,
   **When** o `delete_match` executa, **Then** a reversão acontece tanto no
   ranking global quanto no ranking interno da liga vinculada (se houver).

---

### User Story 5 - Visualizar Ranking da Liga (Priority: P2)

Como participante de uma liga privada, quero abrir a liga e ver o ranking
interno ordenado por pontos da liga.

**Why this priority**: É o feedback de competitividade que dá sentido à liga.
Sem visualizar o ranking, vincular partidas perde valor.

**Independent Test**: Após registrar 1+ partida vinculada a uma liga com pelo
menos 2 participantes, ao abrir a liga, o ranking interno reflete as variações
de pontos aplicadas, com posições e desempates corretos.

**Acceptance Scenarios**:

1. **Given** uma liga com 4+ participantes que registraram partidas vinculadas,
   **When** o usuário abre a liga, **Then** vê o ranking interno ordenado por
   `league_points` DESC, com desempate por wins DESC e losses ASC dentro da liga.
2. **Given** um participante novo sem partidas vinculadas a essa liga,
   **When** o ranking é exibido, **Then** ele aparece com 0 pontos, 0 vitórias
   e 0 derrotas.
3. **Given** o usuário visualiza o ranking interno, **When** sua linha é
   exibida, **Then** ela aparece destacada (mesmo padrão visual do ranking
   global).

---

### Edge Cases

- Upload de foto com formato não suportado (ex: GIF, BMP) → rejeitar com mensagem clara.
- Upload de foto excedendo 2MB → rejeitar com mensagem clara.
- Nickname duplicado no sistema → permitido (não há requisito de unicidade
  para nickname; identificação interna é por `profile.id`).
- Nickname com apenas espaços ou < 2 caracteres → rejeitar com mensagem.
- Liga com 0 participantes (após remoções) → impossível pelo design: dono é
  sempre participante até excluir a liga.
- Tentativa de excluir liga por jogador que não é o dono → rejeitar com erro.
- Partida vinculada a uma liga e em seguida a liga é excluída → a partida
  permanece no histórico global; vínculo é removido sem afetar ranking global.
- Jogador removido de uma liga → suas variações de pontos passadas permanecem
  no ranking interno (histórico imutável), mas ele desaparece da listagem de
  participantes ativos.
- Reentrada de jogador removido em uma liga → cria novo registro de
  participação com 0 pontos (histórico anterior fica inacessível pela UI).

## Requirements *(mandatory)*

### Functional Requirements

#### Edição de Perfil

- **FR-001**: Sistema MUST permitir ao usuário autenticado editar seu próprio
  perfil com os campos: `name` (nickname), `avatar_url` (foto) e `category`
  (categoria informativa).
- **FR-002**: Nickname MUST ter entre 2 e 30 caracteres, sem espaços apenas no
  início/fim (trim aplicado). Caracteres permitidos: letras, números, espaços
  internos, acentos, hifens e sublinhados.
- **FR-003**: Foto de perfil MUST ser opcional. Quando ausente, sistema exibe
  avatar com iniciais (comportamento atual).
- **FR-004**: Upload de foto MUST aceitar apenas formatos JPG, PNG e WebP, com
  tamanho máximo de 2MB. Sistema MUST rejeitar uploads fora desses critérios
  com mensagem clara.
- **FR-005**: Foto MUST ser redimensionada para 256×256 antes da exibição
  (client-side ou server-side via Supabase transformation).
- **FR-006**: Categoria MUST ser um valor enumerado dentre: `1ª`, `2ª`, `3ª`,
  `4ª`, `5ª`, `6ª`, `Open`, `Iniciante`. Campo é opcional (pode ser `NULL`).
- **FR-007**: Categoria MUST coexistir com o nível calculado (Iniciante/Amador/
  Avançado) — não substitui. O nível continua sendo derivado de `points`.
- **FR-008**: Sistema MUST exibir o avatar (foto ou iniciais) em: ranking,
  matchmaking, perfil, histórico de partidas, lista de ligas, ranking da liga.
- **FR-009**: Sistema MUST exibir a categoria como badge informativo no perfil
  e nos cards de matchmaking (quando definida).

#### Ligas Privadas

- **FR-010**: Sistema MUST permitir a qualquer jogador autenticado criar uma
  liga privada com `name` (3–40 caracteres) e `cover_url` (foto de capa, opcional).
- **FR-011**: Ao criar uma liga, o criador MUST se tornar automaticamente o
  dono (`owner_id`) e o primeiro participante com 0 pontos, 0 vitórias e 0
  derrotas internas.
- **FR-012**: Apenas o dono da liga MUST conseguir adicionar e remover
  participantes da liga.
- **FR-013**: Apenas o dono da liga MUST conseguir excluir a liga.
- **FR-013a**: Apenas o dono da liga MUST conseguir editar metadados da liga
  (`name` e `cover_url`). Edição é feita via RPC `update_league` com validação
  de propriedade server-side e Storage policy de `league-covers` escopada
  por `is_league_owner`.
- **FR-014**: Adição de participante MUST ser feita por busca do nickname.
  Tentativa de adicionar jogador já participante MUST ser rejeitada com erro.
- **FR-015**: Cada participante de liga começa com 0 pontos, 0 vitórias e 0
  derrotas internas. Esse contador é independente do ranking global.
- **FR-016**: Sistema MUST exibir uma tela "Minhas Ligas" listando todas as
  ligas em que o usuário atual é dono OU participante.
- **FR-017**: A tela de detalhe da liga MUST exibir: nome, foto de capa,
  contagem de participantes, ranking interno ordenado e botões de ação
  (adicionar membro / sair / excluir liga, conforme permissões).
- **FR-018**: O ranking interno da liga MUST ser ordenado por
  `league_points DESC, league_wins DESC, league_losses ASC` (mesmo desempate
  do ranking global, aplicado aos contadores internos).
- **FR-019**: Não há limite de participantes por liga.

#### Vínculo Partida ↔ Liga

- **FR-020**: A tela de registrar partida MUST exibir um campo opcional
  "Vincular a uma liga" no formato de dropdown.
- **FR-021**: O dropdown MUST listar apenas ligas em que TODOS os 4 jogadores
  selecionados são participantes ativos. Se houver alguma incompatibilidade,
  a liga não aparece. Estado padrão: "Nenhuma" (sem vínculo).
- **FR-022**: O dropdown MUST estar desabilitado até que os 4 jogadores estejam
  selecionados.
- **FR-023**: Quando uma partida é vinculada a uma liga e o registro é bem-sucedido,
  o sistema MUST aplicar a variação de pontos Elo para os 4 jogadores TANTO no
  ranking global (`profiles.points/wins/losses`) QUANTO no ranking interno da
  liga (`league_players.points/wins/losses`).
- **FR-024**: O cálculo Elo da liga MUST usar exatamente a mesma fórmula e
  K-factor do ranking global. A média de pontos da dupla MUST ser calculada
  com base nos `league_points` antes da partida (não nos `profiles.points`).
- **FR-025**: O snapshot de `league_points_before` MUST ser capturado dentro
  da mesma transação atômica de `register_match` para evitar condições de
  corrida (mesma garantia do MVP).
- **FR-026**: Quando uma partida vinculada é excluída dentro da janela de 5
  minutos, o `delete_match` MUST reverter os pontos tanto no ranking global
  quanto no ranking interno da liga vinculada.
- **FR-027**: Sistema MUST armazenar para cada participação na partida vinculada:
  `league_points_before`, `league_points_delta`, `league_points_after`,
  análogos ao histórico do ranking global.
- **FR-028**: Quando uma liga é excluída, partidas previamente vinculadas a ela
  MUST permanecer registradas no histórico global (vínculo da partida com
  liga removida = `NULL`). Não há reversão de pontos globais.
- **FR-029**: Sistema MUST exibir as seguintes mensagens de erro:
  - Foto inválida: "Foto deve ser JPG, PNG ou WebP com até 2MB"
  - Nickname inválido: "Nickname deve ter entre 2 e 30 caracteres"
  - Liga sem nome: "Informe um nome para a liga"
  - Participante duplicado: "Jogador já participa desta liga"
  - Não dono adicionando/removendo/excluindo: "Apenas o dono da liga pode realizar esta ação"
  - Acesso a liga não-participante: "Você não faz parte desta liga"

### Key Entities *(include if feature involves data)*

- **Profile (estendido)**: Acrescenta os campos `avatar_url` (texto, opcional —
  URL relativa do Supabase Storage) e `category` (enum opcional). Demais
  campos do MVP permanecem inalterados.
- **League (Liga)**: Representa uma liga privada. Atributos: `id`, `owner_id`
  (FK→profiles), `name`, `cover_url` (opcional), `created_at`.
- **LeaguePlayer (Participação em Liga)**: Liga um jogador a uma liga com seu
  histórico de pontuação interno. Atributos: `id`, `league_id`, `profile_id`,
  `points` (inicia em 0), `wins`, `losses`, `joined_at`. Único por
  (`league_id`, `profile_id`).
- **MatchLeague (Vínculo Partida↔Liga)**: Liga uma partida registrada a uma
  liga (opcional). Atributos: `match_id` (FK→matches, único), `league_id`
  (FK→leagues, ON DELETE SET NULL). Snapshot de pontuação por jogador na liga
  é armazenado em `match_league_players`.
- **MatchLeaguePlayer (Histórico de Pontuação na Liga)**: Para cada participação
  de jogador em partida vinculada, armazena `league_points_before`,
  `league_points_delta`, `league_points_after`. Análogo a `match_players`
  para a dimensão liga.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um jogador consegue editar o perfil (nome, foto, categoria) e ver
  as alterações refletidas em menos de 5 segundos após salvar.
- **SC-002**: 100% dos registros de partida vinculada atualizam `profiles` e
  `league_players` em uma única transação atômica — qualquer falha (validação,
  Elo global, Elo da liga, snapshot) resulta em rollback completo, sem
  alteração parcial em nenhuma das duas tabelas. (Nota: os deltas Elo das duas
  dimensões podem divergir porque usam bases de pontuação distintas — global
  vs. interna da liga; consistência se refere à atomicidade da transação, não
  à igualdade numérica dos deltas.)
- **SC-003**: Um dono consegue criar uma liga, adicionar 3 membros e registrar
  a primeira partida vinculada em menos de 5 minutos.
- **SC-004**: 95% das uploads de foto válidas (JPG/PNG/WebP ≤ 2MB) concluem em
  menos de 3 segundos em conexão 4G estável.

## Assumptions

- Fotos de perfil e capas de liga ficam armazenadas em buckets diferentes no
  Supabase Storage (`avatars/` e `league-covers/`).
- Nicknames duplicados são permitidos — identificação interna é sempre por UUID.
- Categoria do perfil é cosmética/informativa; não influencia ranking, Elo nem
  matchmaking.
- Liga privada não tem visibilidade pública: somente dono e participantes têm
  acesso à listagem e ranking interno.
- Não há "convite" pendente — a adição é direta (jogador adicionado já é
  participante sem aceitação).
- Não há histórico de auditoria de adição/remoção de participantes no MVP da
  feature — apenas o estado atual.

## Out of Scope (esta feature)

- Convite por link/QR code: dono adiciona diretamente pelo nickname.
- Ligas públicas (qualquer um entra): postergado.
- Solicitação de entrada (jogador pede e dono aprova): postergado.
- Múltiplos donos / co-administradores: apenas 1 dono.
- Transferência de propriedade da liga.
- Filtro de matchmaking por liga (só sugerir jogadores da mesma liga).
- Histórico de partidas filtrável por liga (será adicionado em iteração futura).
- Estatísticas avançadas por liga (médias, sequências, etc).
- Limite de participantes / planos pagos por liga.
