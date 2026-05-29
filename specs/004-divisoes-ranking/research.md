# Research & Decisions: Divisões Dinâmicas do Ranking Global

**Feature**: `004-divisoes-ranking` | **Spec**: [spec.md](spec.md)

Registro das decisões de design e suas alternativas, conforme discutido com o dono
do produto em 2026-05-29.

## D1 — Pontos iniciais: 0 em vez de 1000

**Decisão**: Ranking global começa em **0**.

**Razão**: Começar em 1000 força todo jogador a nascer no nível "Amador" (faixa
`800–1300`), o que dá uma sensação de nível sem mérito. Com 0, o nível/divisão passa
a refletir desempenho real. Além disso, a liga privada (feature 002) já começa em 0 —
unificar o ponto de partida deixa os dois consistentes.

**Alternativas consideradas**:
- Manter 1000 como rating base (estilo Elo clássico): rejeitado porque o produto
  quer que o ranking represente histórico real dentro do app, não um rating estimado.
- Começar em 1000 só no global e 0 na liga: é o estado atual — gera a inconsistência
  que motivou a mudança.

## D2 — Nomenclatura: "Divisão 3/2/1" em vez de "Iniciante/Amador/Avançado"

**Decisão**: A classe de ranking derivada vira **Divisão 3 / Divisão 2 / Divisão 1**
(3 = base, 1 = topo).

**Razão**: O termo "Iniciante" colide — é simultaneamente um valor de **categoria**
declarada (FR-006 da 002) e a classe de ranking de menor pontuação. Isso confunde na
UI e no código. "Divisão" é neutro, escalável e combina com a mecânica de subir/descer:
"subiu para a Divisão 1", "caiu para a Divisão 2".

**Alternativas consideradas** (todas levantadas na conversa):
- **Bronze / Prata / Ouro**: universal e com cara de competição; bom, mas menos
  explícito sobre a relação de ordem (qual é "acima").
- **Base / Acesso / Elite**, **Desafio / Competição / Elite**: vibe esportiva, mas
  mistura registros e "Acesso/Elite" são menos óbvios para todo público.
- **Junior / Pleno / Senior**: rejeitado — sugere idade/carreira, não desempenho.
- **Série C / B / A**: muito intuitivo no Brasil, mas com forte conotação futebolística.
- **Challenger / Pro / Elite**: moderno, mas mistura inglês.

"Divisão 3/2/1" venceu por ser neutro, claro na ordem e natural para promoção/rebaixamento.

## D3 — Classificação por posição relativa (terços), não por faixa fixa de pontos

**Decisão**: A divisão depende da **posição** entre os jogadores ativos, dividida em
**terços dinâmicos**, e não de faixas absolutas de pontos.

**Razão**: Faixas fixas (`<800`, `<1300`) são frágeis — dependem do ponto de partida
(que mudou para 0) e não se adaptam ao tamanho da base. Terços por posição criam
disputa real nas fronteiras e tornam o nível relativo ao grupo.

**Alternativas consideradas**:
- Manter faixas fixas recalibradas para base 0: rejeitado — escolher novos limiares
  seria arbitrário e envelheceria mal conforme a base cresce.
- Percentuais em vez de terços exatos: equivalente; terços (1/3 cada) foi a forma
  simples escolhida.

## D4 — Escopo: só ranking global

**Decisão**: Divisão dinâmica **apenas no ranking global**. Liga privada permanece
ranking simples por pontos/posição.

**Razão**: Manter ligas simples evita complexidade (cada liga teria que calcular seus
próprios terços sobre seus próprios ativos) e preserva o foco da feature. O dono do
produto optou explicitamente por "Só ranking global".

## D5 — Definição de "jogador ativo": ≥1 partida

**Decisão**: Ativo = `wins + losses ≥ 1`. Inativos (0 partidas) ficam sem divisão e
fora da contagem dos terços.

**Razão**: Perfis cadastrados e parados distorceriam as fronteiras se entrassem no
cálculo. Usar "≥1 partida" é simples e não exige infraestrutura de janela temporal.

**Alternativas consideradas**:
- "Ativo nos últimos X dias": mais preciso, mas exige definir X e consultar datas de
  partida — adiado para iteração futura (Out of Scope).
- "Todos cadastrados": rejeitado — perfis parados distorcem os terços.

## D6 — Mínimo de 9 ativos para haver divisões

**Decisão**: Divisões só aparecem com **≥ 9 ativos** (mínimo 3 por divisão). Abaixo
disso, ranking sem badges.

**Razão**: Garante que cada divisão tenha massa suficiente (≥3) para a fronteira fazer
sentido. "Divisão 1 com 1 pessoa" pareceria arbitrário.

**Alternativas consideradas**:
- **6+** (3 por terço, mas mínimo 2 por divisão): considerado, mas 9 dá um piso mais
  confortável de 3 por divisão.
- **3+** (1 por divisão): rejeitado — divisões com 1 pessoa são frágeis.

## D7 — Distribuição da sobra: vai para a Divisão 2 (meio)

**Decisão**: Quando `n` não é múltiplo de 3, a sobra fica na **Divisão 2**.
Formal: `Div1 = Div3 = floor(n/3)`, `Div2 = n − 2·floor(n/3)`.

**Razão**: Preferência do dono do produto — manter o topo (Div 1) e a base (Div 3)
enxutos e previsíveis, com o meio absorvendo a variação. Dá prestígio estável à Div 1.

**Alternativas consideradas**:
- Sobra no topo (Div 1 maior): mais gente na elite — rejeitado.
- Distribuição uniforme (4/4/3 etc.): menos previsível onde cai a fronteira.

## D8 — Empate na fronteira: fica na divisão de baixo

**Decisão**: Empate puro de pontos sobre a fronteira → jogador abaixo na ordem de
desempate fica na **divisão inferior** (promoção conservadora).

**Razão**: Promover por empate seria injusto; exigir superar de fato torna a subida
mais significativa. A ordem de desempate (`wins DESC, losses ASC, name`) já resolve
isso naturalmente ao atribuir por índice.
