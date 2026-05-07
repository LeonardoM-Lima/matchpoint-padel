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
- Q: Como é feito o desempate no ranking quando dois jogadores têm a mesma pontuação? → A: Vitórias em ordem decrescente, depois derrotas em ordem crescente.

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

### User Story 3 - Encontrar Jogadores para Jogar (Prioridade: P3)

Como jogador autenticado, quero ver sugestões de jogadores com indicadores
claros de equilíbrio da partida para decidir quem desafiar.

**Why this priority**: Amplia uso recorrente e o valor social do app, mas não
bloqueia o primeiro registro de partida.

**Independent Test**: A tela de matchmaking mostra cards com nome, nível,
posição no ranking, diferença de pontos, indicador de equilíbrio e botão de
convite via WhatsApp.

**Acceptance Scenarios**:

1. **Given** o usuário está autenticado, **When** acessa a tela de matchmaking,
   **Then** vê uma lista de outros jogadores ordenados por menor diferença de
   pontos, cada card exibindo nome, avatar com iniciais, nível, posição no
   ranking, diferença de pontos e indicador de equilíbrio da partida.
2. **Given** o usuário acessa matchmaking, **When** a lista é exibida, **Then**
   seu próprio perfil não aparece entre os resultados.
3. **Given** um card exibido, **When** a diferença de pontos é ≤ 99, **Then**
   o indicador mostra "Match Perfeito" em verde.
4. **Given** um card exibido, **When** a diferença de pontos é 100–200, **Then**
   o indicador mostra "Partida Equilibrada" em verde.
5. **Given** um card exibido, **When** a diferença é 201–300 e o usuário tem
   mais pontos, **Then** mostra "Você é Favorito" em amarelo; quando tem menos,
   mostra "Desafio Difícil" em amarelo.
6. **Given** um card exibido, **When** a diferença é > 300 e o usuário tem
   mais pontos, **Then** mostra "Grande Favorito" em vermelho; quando tem menos,
   mostra "Grande Desafio" em vermelho.
7. **Given** um card exibido, **When** o usuário já jogou com aquele jogador,
   **Then** o card mostra "Já jogaram Nx"; quando nunca jogaram, mostra
   "Nunca jogaram".
8. **Given** um card exibido, **When** o usuário toca em "Desafiar no WhatsApp",
   **Then** abre o WhatsApp com mensagem: "Oi [nome]! Te desafio para uma
   partida de padel pelo MatchPoint. Topa?"

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

### User Story 5 - Visualizar Histórico de Partidas (Prioridade: P3)

Como jogador, quero ver todas as minhas partidas registradas em ordem cronológica
reversa para acompanhar minha evolução.

**Why this priority**: Complementa a visão de progresso individual já oferecida
pelo perfil (US4), mas não é necessário para o fluxo principal do MVP.

**Independent Test**: Após registrar partidas, o histórico exibe todas elas com
parceiro, adversários, placar, resultado e variação de pontos.

**Acceptance Scenarios**:

1. **Given** um jogador que registrou partidas, **When** acessa o histórico pelo
   perfil, **Then** vê todas as partidas em ordem cronológica reversa, cada uma
   exibindo data, parceiro, adversários, placar, resultado (V/D) e variação de
   pontos.
2. **Given** um jogador novo sem partidas, **When** acessa o histórico, **Then**
   vê estado vazio indicando que nenhuma partida foi registrada ainda.

---

### Edge Cases

- Partida com placar inválido deve ser rejeitada com a mensagem de erro
  correspondente (ver FR-022). Placares inválidos: nenhum score informado,
  vencedor com < 6 games (ex: 5–4, 3–3), ou placar impossível (ex: 8–2, 6–5).
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
  O nível inicial é "Amador" (1000 pontos situa-se na faixa 800–1299). Sistema
  MUST garantir um único profile por usuário autenticado.
- **FR-003a**: Sistema MUST calcular e exibir o nível do jogador automaticamente
  com base na pontuação atual: 0–799 = Iniciante, 800–1299 = Amador, 1300+ = Avançado.
  O nível MUST ser recalculado sempre que a pontuação do jogador for atualizada.
- **FR-004**: Usuário autenticado MUST conseguir registrar uma partida 2x2 com
  exatamente 4 jogadores (2 por time). Um jogador MUST NOT aparecer mais de uma
  vez na mesma partida.
- **FR-005**: No MVP, uma partida consiste em exatamente 1 set — não há set 2.
  O cliente envia apenas os games de cada time (ex: 6 e 4). O sistema MUST
  aceitar o registro somente quando o placar do set for válido:
  - **FR-005a**: O vencedor do set tem 6 ou 7 games.
  - **FR-005b**: Se o vencedor tem 6 games, o perdedor tem no máximo 4 (ex: 6–4, 6–0).
  - **FR-005c**: Se o vencedor tem 7 games (tiebreak), o perdedor tem 5 ou 6 (ex: 7–5, 7–6).
  - **FR-005d**: O `winner_team` MUST ser derivado server-side comparando os
    games dos dois times — o time com mais games vence. O cliente MUST NOT
    enviar `winner_team` diretamente.
- **FR-006**: Sistema MUST atualizar a pontuação dos jogadores usando um sistema
  de rating dinâmico inspirado no modelo Elo, considerando a diferença de
  pontuação média entre as duplas antes da partida. O K-factor MUST ser 32 no
  MVP:
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
  caso de empate de pontos, o desempate MUST ser por wins DESC, depois losses
  ASC.
- **FR-010**: Home MUST exibir pontuação atual do usuário, posição no ranking e
  progresso em relação ao próximo jogador acima.
- **FR-011**: Tela de matchmaking MUST excluir o usuário atual e ordenar
  resultados por menor diferença de pontos em relação ao usuário atual.
- **FR-011a**: Cada card de matchmaking MUST exibir: nome, avatar com iniciais,
  nível, posição no ranking e diferença de pontos em relação ao usuário atual.
- **FR-011b**: Cada card MUST exibir um indicador de equilíbrio baseado na
  diferença absoluta de pontos entre os dois jogadores:
  - 0–99 pts → "Match Perfeito" (verde)
  - 100–200 pts → "Partida Equilibrada" (verde)
  - 201–300 pts → "Você é Favorito" ou "Desafio Difícil" (amarelo)
  - 301+ pts → "Grande Favorito" ou "Grande Desafio" (vermelho)
- **FR-011c**: O indicador MUST usar a variante favorável ("Você é Favorito",
  "Grande Favorito") quando o usuário atual tiver mais pontos que o sugerido,
  e a variante desfavorável ("Desafio Difícil", "Grande Desafio") quando tiver
  menos pontos.
- **FR-011d**: Cada card MUST exibir o histórico de confrontos diretos entre o
  usuário atual e o jogador sugerido: "Já jogaram Nx" (ex: "Já jogaram 3x") ou
  "Nunca jogaram" quando não há partidas em comum.
- **FR-011e**: Cada card MUST exibir botão "Desafiar no WhatsApp" que abre o
  WhatsApp com mensagem pré-preenchida: "Oi [nome]! Te desafio para uma partida
  de padel pelo MatchPoint. Topa?" — [nome] é o nickname do jogador sugerido.
- **FR-011f**: Cards de matchmaking MUST NOT exibir aproveitamento geral
  (win rate) do jogador sugerido — esse dado não é relevante para a decisão de
  quem desafiar.
- **FR-012**: Usuário MUST NOT conseguir alterar diretamente a pontuação de
  outros jogadores — variações de pontuação ocorrem exclusivamente via lógica
  centralizada de cálculo de rating após o registro de uma partida.
- **FR-013**: Perfil MUST exibir botão "Ver histórico de partidas" abaixo dos
  stats (vitórias, derrotas, aproveitamento).
- **FR-014**: Ao clicar no botão, MUST abrir tela de histórico com scroll
  mostrando todas as partidas do jogador.
- **FR-015**: Cada partida MUST exibir: data, parceiro de dupla, adversários,
  placar, resultado (V/D) e variação de pontos (ex: +27 ou -10).
- **FR-016**: Formato de exibição MUST ser:
  "Com [parceiro] contra [adversário1] e [adversário2]".
- **FR-017**: Partidas MUST ser ordenadas da mais recente para a mais antiga.
- **FR-018**: Botão "Atualizar perfil" MUST ser removido da tela de perfil no
  MVP — edição de perfil é pós-MVP.
- **FR-019**: O criador de uma partida MUST conseguir excluí-la dentro de 5
  minutos após o registro. Ao excluir, o sistema MUST reverter a pontuação,
  vitórias e derrotas de todos os jogadores envolvidos para os valores
  anteriores à partida.
- **FR-020**: Após 5 minutos do registro, a partida MUST ser permanente —
  nenhum jogador pode excluí-la ou editá-la.
- **FR-021**: O registro de partida MUST executar em uma transação atômica
  única. Em caso de qualquer falha — validação, inserção ou cálculo de Elo —
  o sistema MUST fazer rollback completo. Nenhuma alteração parcial deve
  persistir em `matches`, `match_players` ou `profiles`.
- **FR-022**: O sistema MUST exibir as seguintes mensagens de erro ao usuário
  no fluxo de registro de partida:
  - Menos de 4 jogadores selecionados: "Selecione 4 jogadores para continuar"
  - Placar não preenchido: "Informe o placar do set"
  - Placar impossível (ex: 3–3, 5–4): "Placar inválido — um time deve atingir 6 games"
  - Erro ao salvar (falha no servidor): "Não foi possível salvar a partida. Tente novamente."
  - Tentativa de exclusão por jogador que não é o criador: código
    `MATCH_DELETE_FORBIDDEN`, status 403, mensagem "Apenas o criador da partida
    pode excluir este registro."

### Key Entities *(include if feature involves data)*

- **Jogador (Profile)**: Identidade do usuário no sistema. Atributos: nickname
  (nome de exibição, obrigatório), email, pontuação atual, total de vitórias,
  total de derrotas. Nível é derivado automaticamente da pontuação
  (Iniciante / Amador / Avançado) — não é armazenado como campo editável.
- **Partida (Match)**: Registro de uma partida 2x2. Atributos: criador,
  games do time A, games do time B (1 set único no MVP), time vencedor (A ou B —
  derivado server-side), data/hora gerada pelo servidor.
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
- `played_at` é gerado pelo servidor via `DEFAULT now()` — o cliente não envia
  esse valor.
- No MVP há exatamente 1 set por partida — campos de set 2 não existem.

## Out of Scope (MVP)

Ligas privadas, feed social, feed de jogadas, análise de vídeo com IA,
antifraude avançado, confirmação obrigatória de todos os jogadores, pagamentos,
notificações push.
