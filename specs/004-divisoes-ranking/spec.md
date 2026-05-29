# Feature Specification: Divisões Dinâmicas do Ranking Global

**Feature Branch**: `004-divisoes-ranking`
**Created**: 2026-05-29
**Status**: Draft
**Input**: User description: "Ranking global começa com 0 pontos; renomear a classe de
ranking (que hoje colide com a categoria 'Iniciante') para Divisão 3 / Divisão 2 /
Divisão 1; e calcular a divisão por posição relativa entre jogadores ativos (terços
dinâmicos), não por faixas fixas de pontos."

## Contexto e Motivação

Hoje o app tem **dois** vocabulários que se sobrepõem e confundem:

1. **Categoria** (auto-declarada, cosmética): `1ª, 2ª, 3ª, 4ª, 5ª, 6ª, Open, Iniciante`
   — definida na feature 002 (FR-006), não influencia ranking nem Elo.
2. **Nível / classe de ranking** (derivada de pontos): `Iniciante, Amador, Avançado`
   — calculada por faixas fixas de pontos em `ranking.service.ts#getLevel`
   (`<800 Iniciante`, `<1300 Amador`, `≥1300 Avançado`).

O termo **"Iniciante"** aparece nos dois — uma vez como categoria declarada e outra
como classe derivada de pontos. Isso é ambíguo na UI e no código.

Decisões tomadas (Clarifications abaixo):

- O **ranking global** passa a começar em **0 pontos** (hoje `default 1000`).
- A **classe de ranking** é renomeada para **Divisão 3 / Divisão 2 / Divisão 1**
  (Divisão 3 = base, Divisão 1 = topo).
- A classe deixa de ser por **faixa fixa de pontos** e passa a ser por **posição
  relativa** entre os **jogadores ativos**, distribuída em **terços dinâmicos**.
- A **categoria** declarada (incluindo o valor "Iniciante") permanece inalterada.

## Clarifications

### Session 2026-05-29

- Q: O ranking global começa em 0 ou mantém 1000? → A: Começa em **0**. Todo jogador
  nasce na divisão base; o nível passa a refletir desempenho real, não um rating
  estimado inicial. A liga privada (feature 002) já começa em 0 — fica coerente.
- Q: A divisão dinâmica por posição se aplica onde? → A: **Somente no ranking global.**
  A liga privada continua simples (só pontos/posição, sem divisões internas).
- Q: O que define "jogador ativo" para entrar no cálculo das divisões? → A: Jogou
  **pelo menos 1 partida** registrada no ranking global (`wins + losses ≥ 1`).
  Quem tem 0 partidas fica **sem divisão** (não entra no cálculo dos terços).
- Q: A partir de quantos ativos faz sentido dividir em 3? → A: **9 ou mais** ativos
  (mínimo 3 por divisão). Abaixo de 9, **não há divisões** — exibe apenas o ranking
  por posição.
- Q: Quando o número de ativos não é múltiplo de 3, onde fica a sobra? → A: A sobra
  vai para a **Divisão 2 (meio)**. Formalmente: `Div1 = floor(n/3)`,
  `Div3 = floor(n/3)`, `Div2 = n − Div1 − Div3` (recebe o resto).
- Q: Empate de pontos exatamente na fronteira entre duas divisões? → A: O empatado
  fica na **divisão de baixo** até superar de fato o vizinho de cima
  (promoção conservadora). O desempate de posição continua sendo
  `wins DESC, losses ASC, name` (igual ao ranking), mas pontos iguais na borda
  **não** promovem.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ranking Global Começa em Zero (Priority: P1) 🎯

Como produto, quero que todo novo jogador comece o ranking global com 0 pontos,
para que o nível/divisão reflita desempenho real e não um rating inicial artificial.

**Why this priority**: É a base das demais decisões. Os terços dinâmicos só fazem
sentido se a pontuação inicial não inflar artificialmente a posição.

**Independent Test**: Criar uma conta nova e abrir o ranking — o jogador aparece
com **0 pontos** (e sem divisão, por ter 0 partidas).

**Acceptance Scenarios**:

1. **Given** um novo cadastro, **When** o perfil é criado, **Then** `points = 0`,
   `wins = 0`, `losses = 0`.
2. **Given** um jogador recém-criado (0 partidas), **When** abre o ranking,
   **Then** aparece listado com 0 pontos e **sem badge de divisão**.
3. **Given** a base existente foi criada com `default 1000`, **When** a migração
   roda, **Then** TODOS os perfis existentes têm `points`, `wins` e `losses`
   zerados (reset total — opção B da política de migração em
   [data-model.md](./data-model.md)). O histórico de partidas (`match_players`)
   permanece intacto.
4. **Given** o reset total foi aplicado, **When** o ranking é aberto logo após o
   deploy, **Then** todos os jogadores aparecem como **inativos** (0 partidas) e
   **sem divisão**, até que novas partidas sejam registradas.

---

### User Story 2 - Classe de Ranking Renomeada para Divisões (Priority: P1) 🎯

Como jogador, quero ver minha classe de ranking como "Divisão 3/2/1" em vez de
"Iniciante/Amador/Avançado", para não confundir com a categoria que eu declarei.

**Why this priority**: Resolve o conflito de vocabulário direto. Sem isso, "Iniciante"
significa duas coisas diferentes na mesma tela.

**Independent Test**: Em qualquer tela que hoje mostra "Iniciante/Amador/Avançado"
como nível, passa a mostrar "Divisão 3/Divisão 2/Divisão 1"; a categoria declarada
(que pode ser "Iniciante") continua exibida como badge separado e inalterado.

**Acceptance Scenarios**:

1. **Given** um jogador ativo no topo do ranking, **When** vê seu nível,
   **Then** lê "Divisão 1" (não "Avançado").
2. **Given** um jogador ativo na base, **When** vê seu nível, **Then** lê
   "Divisão 3" (não "Iniciante").
3. **Given** um jogador com categoria declarada "Iniciante", **When** abre o perfil,
   **Then** o badge de **categoria** continua "Iniciante" e o badge de **divisão**
   é independente (ex.: "Divisão 2"). Os dois coexistem sem ambiguidade textual.

---

### User Story 3 - Divisão por Posição Relativa em Terços (Priority: P1) 🎯

Como jogador, quero que minha divisão dependa da minha posição entre os jogadores
ativos (não de uma faixa fixa de pontos), para que subir no ranking signifique
subir de divisão de forma justa e dinâmica.

**Why this priority**: É o coração da feature — substitui as faixas fixas
(`800/1300`) por terços calculados sobre os ativos.

**Independent Test**: Com ≥9 jogadores ativos, o ranking é dividido em terços;
quem está no topo é Divisão 1, no meio Divisão 2, na base Divisão 3. Conforme as
posições mudam, as divisões recalculam.

**Acceptance Scenarios**:

1. **Given** 9 jogadores ativos ordenados por ranking, **When** as divisões são
   calculadas, **Then** as posições 1–3 = Divisão 1, 4–6 = Divisão 2, 7–9 = Divisão 3.
2. **Given** 10 jogadores ativos (não múltiplo de 3), **When** calculado,
   **Then** Divisão 1 = 3, Divisão 2 = **4** (recebe a sobra), Divisão 3 = 3.
3. **Given** 11 jogadores ativos, **When** calculado, **Then** Divisão 1 = 3,
   Divisão 2 = **5**, Divisão 3 = 3.
4. **Given** o jogador na fronteira inferior da Divisão 1 e o jogador no topo da
   Divisão 2, **When** o segundo ultrapassa o primeiro em pontos (com desempate),
   **Then** eles trocam de posição e **automaticamente** de divisão na próxima
   recálculo do ranking.
5. **Given** dois jogadores empatados em pontos na fronteira entre duas divisões,
   **When** as divisões são calculadas, **Then** o que está logo abaixo na ordem
   de desempate (`wins DESC, losses ASC, name`) fica na **divisão de baixo** — o
   empate puro de pontos não promove.

---

### User Story 4 - Poucos Jogadores: Sem Divisões (Priority: P2)

Como jogador em um app com poucos ativos, quero ver apenas o ranking por posição
(sem rótulos de divisão), para que a divisão não vire um rótulo sem sentido quando
há gente demais ou de menos em cada faixa.

**Why this priority**: Evita que "Divisão 1 com 1 pessoa" pareça arbitrário.
Garante que a fronteira só apareça quando há massa suficiente.

**Independent Test**: Com 8 ou menos jogadores ativos, nenhuma divisão é atribuída;
a tela mostra ranking por posição sem badges de divisão. Ao atingir 9 ativos, as
divisões aparecem.

**Acceptance Scenarios**:

1. **Given** 8 jogadores ativos, **When** abrem o ranking, **Then** veem posições
   e pontos, mas **nenhum badge de divisão**.
2. **Given** o 9º jogador joga sua primeira partida (vira ativo), **When** o ranking
   recalcula, **Then** as divisões passam a ser exibidas para todos os ativos.
3. **Given** jogadores com 0 partidas convivem com ativos, **When** as divisões são
   calculadas, **Then** os de 0 partidas **não** entram no cálculo dos terços e
   ficam sem badge de divisão (continuam listados no ranking).

---

### Edge Cases

- **Ranking com 0 ativos** (todos com 0 partidas) → sem divisões; só lista.
- **Exatamente 9 ativos** → primeiro caso em que divisões aparecem (3/3/3).
- **n não múltiplo de 3** → sobra sempre para a Divisão 2 (meio).
- **Empate de pontos cruzando a fronteira** → empatado fica na divisão de baixo.
- **Jogador inativo recente** (jogou no passado, mas a regra atual é "≥1 partida
  histórica") → permanece ativo pela definição escolhida (não há janela temporal
  nesta feature; ver Out of Scope).
- **Categoria "Iniciante" vs Divisão** → nunca mais colidem textualmente; são dois
  badges com vocabulários distintos.
- **Migração da base 1000** → ver OQ-1; não deve quebrar o histórico de partidas
  já registrado.

## Requirements *(mandatory)*

### Functional Requirements

#### Pontuação Inicial

- **FR-001**: O ranking global MUST iniciar todo novo perfil com `points = 0`
  (substitui o `default 1000` atual em `profiles.points`).
- **FR-002**: O Elo global MUST continuar usando a mesma fórmula e K-factor do MVP;
  apenas o ponto de partida muda de 1000 para 0. A média de pontos da dupla é
  calculada sobre os `profiles.points` antes da partida (inalterado).
- **FR-003**: A constraint `points >= 0` MUST ser mantida.

#### Nomenclatura de Divisão

- **FR-004**: A classe de ranking derivada MUST ser renomeada de
  `Iniciante | Amador | Avançado` para `Divisão 3 | Divisão 2 | Divisão 1`,
  onde **Divisão 3 é a base** e **Divisão 1 é o topo**.
- **FR-005**: A renomeação MUST se aplicar a todas as telas que hoje exibem o nível:
  ranking, matchmaking, perfil próprio, perfil público de outro jogador.
- **FR-006**: A **categoria** declarada (`1ª…6ª, Open, Iniciante`) MUST permanecer
  inalterada e ser exibida como badge **independente** da divisão. O valor de
  categoria "Iniciante" NÃO deve ser confundido com divisão.

#### Cálculo Dinâmico de Divisões

- **FR-007**: A divisão MUST ser calculada por **posição relativa** entre os
  **jogadores ativos**, NÃO por faixas fixas de pontos. As constantes `800` e `1300`
  do `getLevel` atual MUST ser removidas.
- **FR-008**: "Jogador ativo" MUST ser definido como `wins + losses ≥ 1`
  (pelo menos 1 partida registrada no ranking global).
- **FR-009**: Jogadores **não ativos** (0 partidas) MUST ficar **sem divisão**
  (sem badge) e NÃO entram na contagem `n` usada para calcular os terços.
- **FR-010**: As divisões só MUST ser atribuídas quando houver **≥ 9 jogadores
  ativos**. Com 8 ou menos ativos, nenhuma divisão é atribuída (ranking sem badges).
- **FR-011**: Com `n` ativos (n ≥ 9), os tamanhos MUST ser:
  - `tamanhoDiv1 = floor(n / 3)` (topo)
  - `tamanhoDiv3 = floor(n / 3)` (base)
  - `tamanhoDiv2 = n − tamanhoDiv1 − tamanhoDiv3` (meio, recebe a sobra)
- **FR-012**: A atribuição MUST seguir a ordem do ranking (mesmo comparador atual:
  `points DESC, wins DESC, losses ASC, name ASC`): as primeiras `tamanhoDiv1`
  posições = Divisão 1, as próximas `tamanhoDiv2` = Divisão 2, as últimas
  `tamanhoDiv3` = Divisão 3.
- **FR-013**: Quando há **empate de pontos** exatamente sobre a fronteira entre duas
  divisões, o jogador que fica **abaixo** na ordem de desempate MUST ser atribuído
  à **divisão inferior** (promoção conservadora: empate de pontos puro não sobe).
- **FR-014**: A troca de divisão MUST ser **automática** no próximo cálculo do
  ranking: se um jogador ultrapassa o vizinho da divisão de cima, ambos trocam de
  posição e de divisão sem ação manual.
- **FR-015**: O cálculo de divisões MUST ser **derivado** (não persistido) — assim
  como o nível atual é derivado e não armazenado. Recalcula sempre que o ranking é
  montado.

### Key Entities *(include if feature involves data)*

- **Profile (alterado)**: `points` passa a ter `default 0` (era 1000). Demais campos
  inalterados. `level`/`division` continua **derivado** (não armazenado).
- **Division (conceito derivado)**: rótulo calculado em tempo de leitura a partir da
  posição relativa entre ativos. Valores: `Divisão 1`, `Divisão 2`, `Divisão 3`, ou
  ausente (sem divisão) para inativos ou quando há < 9 ativos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% dos novos perfis criados após a migração têm `points = 0`.
- **SC-002**: Em uma base com ≥ 9 ativos, os tamanhos das divisões satisfazem
  `Div1 = Div3 = floor(n/3)` e `Div2 = resto`, verificável por teste unitário.
- **SC-003**: Nenhuma tela exibe simultaneamente "Iniciante" como divisão e como
  categoria de forma ambígua — divisão usa exclusivamente "Divisão 1/2/3".
- **SC-004**: Quando um jogador ultrapassa o vizinho de divisão superior, a divisão
  exibida muda no próximo carregamento do ranking, sem ação manual.

## Assumptions

- A definição de "ativo" nesta feature é puramente por contagem de partidas
  (`≥1`), sem janela temporal. Uma janela "últimos X dias" fica para iteração futura.
- A liga privada (feature 002) NÃO ganha divisões — permanece ranking por posição/pontos.
- O Elo e o histórico de partidas (`match_players`) não mudam de fórmula; apenas o
  ponto de partida global muda.

## Out of Scope (esta feature)

- Divisões dentro de ligas privadas.
- Janela temporal de atividade ("ativo nos últimos X dias").
- Promoção/rebaixamento com notificação push ("você subiu para a Divisão 1").
- Persistência histórica de divisão por temporada.
- Recompensas/badges visuais especiais por divisão além do rótulo.
- Mais de 3 divisões (Divisão 4+) ou subdivisões.

## Decisões de Migração

- **OQ-1 (RESOLVIDO 2026-05-29)**: ao trocar `default` para 0, **todos os perfis
  existentes** têm `points`, `wins` e `losses` zerados na mesma migração (reset
  total — opção B). O histórico de partidas (`match_players`) permanece. Detalhes
  e SQL em [data-model.md](./data-model.md).
