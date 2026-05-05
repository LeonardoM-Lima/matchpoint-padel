# Feature Specification: MVP MatchPoint Padel

**Feature Branch**: `001-matchpoint-mvp`
**Created**: 2026-05-04
**Status**: Draft
**Input**: User description: "Construir o MVP do MatchPoint Padel"

## Clarifications

### Session 2026-05-04

- Q: Como é determinado o "nível" do jogador? → A: Tiers automáticos calculados por faixas de pontuação atual: 0–799 = Iniciante, 800–1299 = Amador, 1300+ = Avançado.
- Q: Como o sistema valida o placar de um set? → A: Set válido = vencedor com ao menos 6 games; tiebreak permite placar até 7 games (7–5 ou 7–6). Scores inválidos devem ser rejeitados.
- Q: Qual é a origem do nome exibido do jogador? → A: Nome de exibição personalizado (nickname) inserido pelo jogador no momento do cadastro — não precisa ser nome real.
- Q: Partidas registradas podem ser corrigidas ou excluídas? → A: Criador pode excluir a partida nos primeiros 5 minutos após o registro; o sistema reverte a pontuação de todos os jogadores envolvidos. Após 5 minutos, a partida é permanente.
- Q: Como é feito o desempate no ranking quando dois jogadores têm a mesma pontuação? → A: Número de partidas jogadas (quem jogou mais ocupa posição melhor). Incentiva engajamento.

## User Scenarios & Testing *(mandatory)*

<!--
  User stories are ordered by priority (P1 first). Each is independently testable
  and delivers value on its own — implementing only P1 yields a viable MVP.
-->

### User Story 1 - Registrar Partida e Ver Ranking Atualizado (Priority: P1) 🎯 MVP

Como jogador autenticado, quero registrar uma partida 2x2 com placar para que o
sistema atualize automaticamente meu ranking e o dos outros jogadores.

**Why this priority**: É o coração do produto. Sem registrar partidas e ver o
ranking atualizado, o app não entrega valor algum.

**Independent Test**: Usuário cria conta, registra uma partida 2x2 com placar
válido em ao menos um set e vê seus pontos atualizados na home e no ranking
global.

**Acceptance Scenarios**:

1. **Given** um usuário autenticado com perfil criado, **When** ele registra uma
   partida 2x2 com 4 jogadores e placar válido, **Then** o sistema aceita a
   partida, atualiza a pontuação dos 4 jogadores conforme o algoritmo de rating
   dinâmico e exibe os novos pontos na home e no ranking.
2. **Given** um usuário não autenticado, **When** tenta acessar o formulário de
   registro de partida, **Then** o sistema bloqueia o acesso e redireciona para
   login.
3. **Given** um usuário autenticado, **When** envia uma partida com placar
   inválido (ex.: 5–4, 8–2, ou 6–5 sem resolução), **Then** o sistema rejeita
   a submissão e exibe mensagem de erro indicando o motivo.
4. **Given** uma dupla com pontuação média menor vence a dupla com pontuação
   média maior, **When** o sistema processa o resultado, **Then** a dupla
   vencedora recebe mais pontos do que receberia numa vitória esperada, e a
   dupla perdedora perde menos pontos do que perderia numa derrota esperada.

---

### User Story 2 - Visualizar Posição no Ranking Global (Priority: P2)

Como jogador autenticado, quero ver o ranking global de jogadores ordenado por
pontuação, com destaque para minha posição e jogadores próximos acima/abaixo
com diferença de pontos visível.

**Why this priority**: Dá sentido competitivo ao registro de partidas; sem
ranking visível, o usuário não percebe seu progresso.

**Independent Test**: Dado um conjunto de jogadores com pontuações distintas, o
ranking lista todos ordenados de forma decrescente, destaca o usuário atual e
exibe o delta de pontos para os vizinhos imediatos.

**Acceptance Scenarios**:

1. **Given** múltiplos jogadores com pontuações distintas, **When** o usuário
   acessa a tela de ranking, **Then** todos os jogadores aparecem listados em
   ordem decrescente de pontuação.
2. **Given** o usuário está logado, **When** visualiza o ranking, **Then** sua
   linha aparece destacada visualmente e mostra a diferença de pontos para o
   jogador acima e para o jogador abaixo.
3. **Given** um jogador novo sem partidas, **When** acessa o ranking, **Then**
   aparece listado com a pontuação inicial (1000 pontos).

---

### User Story 3 - Encontrar Jogadores de Nível Parecido (Priority: P3)

Como jogador autenticado, quero ver sugestões de jogadores com pontuação
próxima à minha para visualizar potenciais adversários.

**Why this priority**: Amplia uso recorrente e o valor social do app, mas não
bloqueia o primeiro registro de partida.

**Independent Test**: A tela de matchmaking mostra cards com nome, nível,
posição no ranking e pontos, ordenados por proximidade de pontuação, excluindo
o usuário atual.

**Acceptance Scenarios**:

1. **Given** o usuário está autenticado, **When** acessa a tela de matchmaking,
   **Then** vê uma lista de outros jogadores ordenados por proximidade de
   pontuação (mais próximos primeiro), cada card exibindo nome, nível, posição
   no ranking e pontos.
2. **Given** o usuário acessa matchmaking, **When** a lista é exibida, **Then**
   seu próprio perfil não aparece entre os resultados.

---

### User Story 4 - Visualizar Perfil Pessoal (Priority: P3)

Como jogador autenticado, quero ver meu perfil com nome, nível, pontos,
vitórias e derrotas para acompanhar minha evolução.

**Why this priority**: Complementa a visão de progresso individual, mas não é
necessário para o fluxo principal do MVP.

**Independent Test**: Após registrar partidas, o perfil reflete contadores
corretos de vitórias, derrotas e pontuação atual.

**Acceptance Scenarios**:

1. **Given** um jogador que registrou partidas, **When** acessa seu perfil,
   **Then** visualiza nome, nível, pontuação atual, total de vitórias e total de
   derrotas — todos refletindo o histórico real de partidas.
2. **Given** um jogador novo sem partidas, **When** acessa seu perfil, **Then**
   vê pontuação inicial (1000), vitórias = 0, derrotas = 0 e nível = "Amador".

---

### Edge Cases

- Partida com placar inválido deve ser rejeitada com mensagem de erro clara.
  Placares inválidos incluem: sem 4 jogadores, sem ao menos um set preenchido,
  set com vencedor < 6 games, set 6–5 (sem resolução), ou set com placar
  impossível (ex: 8–2).
- Pontuação de qualquer jogador não pode ficar abaixo de 0 — o piso é 0.
- Jogador novo (sem partidas registradas) deve aparecer no ranking com pontuação
  inicial de 1000 pontos.
- Tentativa de registrar partida sem estar autenticado deve ser bloqueada e
  redirecionar para a tela de login.
- Tentativa de excluir partida após 5 minutos do registro deve ser bloqueada
  com mensagem informando que o prazo de exclusão expirou.
- Apenas o criador da partida pode excluí-la — os demais jogadores MUST NOT
  ter acesso à ação de exclusão.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Sistema MUST permitir cadastro com email, senha e nickname (nome
  de exibição personalizado). O nickname MUST ser obrigatório e MUST ser exibido
  no ranking, nos cards de matchmaking e no perfil.
- **FR-002**: Sistema MUST permitir login e logout.
- **FR-003**: Sistema MUST criar o perfil do jogador automaticamente após
  cadastro, com pontuação inicial de 1000 pontos, vitórias = 0 e derrotas = 0.
  O nível inicial é "Amador" (1000 pontos situa-se na faixa 800–1299).
- **FR-003a**: Sistema MUST calcular e exibir o nível do jogador automaticamente
  com base na pontuação atual: 0–799 = Iniciante, 800–1299 = Amador, 1300+ = Avançado.
  O nível MUST ser recalculado sempre que a pontuação do jogador for atualizada.
- **FR-004**: Usuário autenticado MUST conseguir registrar uma partida 2x2 com
  exatamente 4 jogadores (2 por time).
- **FR-005**: Sistema MUST exigir ao menos um set com placar válido para aceitar
  o registro da partida. Um set é válido quando:
  - **FR-005a**: O vencedor do set tem 6 ou 7 games.
  - **FR-005b**: Se o vencedor tem 6 games, o perdedor tem no máximo 4 (ex: 6–4, 6–0).
  - **FR-005c**: Se o vencedor tem 7 games (tiebreak), o perdedor tem 5 ou 6 (ex: 7–5, 7–6).
  - Qualquer outro placar MUST ser rejeitado com mensagem de erro específica.
- **FR-006**: Sistema MUST atualizar a pontuação dos jogadores usando um sistema
  de rating dinâmico inspirado no modelo Elo, considerando a diferença de
  pontuação média entre as duplas antes da partida:
  - **FR-006a**: Sistema MUST calcular a pontuação média de cada dupla antes da
    partida.
  - **FR-006b**: Sistema MUST conceder mais pontos à dupla vencedora quando ela
    vencer adversários com pontuação média maior.
  - **FR-006c**: Sistema MUST conceder menos pontos à dupla vencedora quando
    ela vencer adversários com pontuação média menor.
  - **FR-006d**: Sistema MUST remover mais pontos da dupla perdedora quando ela
    perder para adversários com pontuação média menor.
  - **FR-006e**: Sistema MUST remover menos pontos da dupla perdedora quando
    ela perder para adversários com pontuação média maior.
  - **FR-006f**: A variação de pontos MUST ser aplicada individualmente a cada
    jogador da dupla.
  - **FR-006g**: Sistema MUST armazenar, para cada jogador em cada partida:
    pontuação anterior, variação aplicada e nova pontuação.
- **FR-007**: Pontuação MUST ter piso de 0 — nenhum jogador pode ter pontuação
  negativa.
- **FR-008**: Sistema MUST atualizar os contadores de vitórias e derrotas de
  cada jogador após cada partida registrada.
- **FR-009**: Ranking MUST ser ordenado por pontuação de forma decrescente. Em
  caso de empate na pontuação, o desempate MUST ser feito pelo número total de
  partidas jogadas (mais partidas = posição melhor).
- **FR-010**: Home MUST exibir pontuação atual do usuário, posição no ranking e
  progresso em relação ao próximo jogador acima.
- **FR-011**: Tela de matchmaking MUST excluir o usuário atual e ordenar
  resultados por proximidade de pontuação.
- **FR-012**: Usuário MUST NOT conseguir alterar diretamente a pontuação de
  outros jogadores — variações de pontuação ocorrem exclusivamente via lógica
  centralizada de cálculo de rating após o registro de uma partida.
- **FR-013**: O criador de uma partida MUST conseguir excluí-la dentro de 5
  minutos após o registro. Ao excluir, o sistema MUST reverter a pontuação,
  vitórias e derrotas de todos os jogadores envolvidos para os valores
  anteriores à partida.
- **FR-014**: Após 5 minutos do registro, a partida MUST ser permanente —
  nenhum jogador pode excluí-la ou editá-la.

### Key Entities *(include if feature involves data)*

- **Jogador (Profile)**: Identidade do usuário no sistema. Atributos: nickname
  (nome de exibição, obrigatório), email, pontuação atual, total de vitórias,
  total de derrotas. Nível é derivado automaticamente da pontuação
  (Iniciante / Amador / Avançado) — não é armazenado como campo editável.
- **Partida (Match)**: Registro de uma partida 2x2. Atributos: criador, data,
  placar por set, time vencedor (A ou B).
- **Participação (MatchPlayer)**: Relaciona um jogador a uma partida. Atributos:
  time (A ou B), resultado (vitória/derrota), pontuação antes da partida,
  variação de pontuação aplicada, pontuação após a partida.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um novo usuário consegue criar conta e registrar a primeira
  partida em menos de 3 minutos usando o celular.
- **SC-002**: 95% dos registros de partida concluem com o ranking atualizado em
  menos de 2 segundos após a submissão.
- **SC-003**: Após 10 partidas registradas, o ranking reflete corretamente a
  ordenação por pontuação para 100% dos jogadores envolvidos.
- **SC-004**: Em teste com 5 jogadores reais, todos completam o fluxo
  cadastro → registrar partida → ver ranking sem ajuda externa.

## Assumptions

- Jogadores iniciam com 1000 pontos ao criar a conta.
- No MVP, apenas o criador registra a partida — não há confirmação obrigatória
  dos outros 3 jogadores envolvidos.
- Conectividade estável — sem suporte a modo offline no MVP.
- Idioma único: português do Brasil (pt-BR).
- O MVP usa um fator de variação fixo (K-factor fixo) para o cálculo de rating
  dinâmico.
- A força de uma dupla é calculada pela média de pontos dos dois jogadores antes
  da partida.

## Out of Scope (MVP)

Ligas privadas, feed social, feed de jogadas, análise de vídeo com IA,
antifraude avançado, confirmação obrigatória de todos os jogadores, pagamentos,
notificações push.
