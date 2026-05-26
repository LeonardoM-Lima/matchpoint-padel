# Full-Spectrum Requirements Checklist: MVP PadelUP

**Purpose**: Revisão completa da qualidade dos requisitos antes de /speckit-tasks.
Valida completude, clareza, consistência e mensurabilidade dos requisitos escritos —
não verifica comportamento de implementação.
**Created**: 2026-05-04
**Audience**: Autor — revisão pré-tasks
**Feature**: [spec.md](../spec.md) | [plan.md](../plan.md) | [data-model.md](../data-model.md)

---

## 1. Segurança & Auth — Qualidade dos Requisitos

- [x] CHK001 — São listadas explicitamente todas as rotas/fluxos que exigem autenticação e aquelas que são públicas? [Completeness, Gap]
- [x] CHK002 — O comportamento quando a sessão do usuário expira durante o fluxo de registro de partida está especificado como requisito? [Edge Case, Gap] — Nota: aceito pós-MVP; no MVP, tratar como erro genérico de autenticação.
- [x] CHK003 — As permissões RLS por tabela (quem pode SELECT/INSERT/UPDATE em `profiles`, `matches`, `match_players`) estão documentadas como requisitos funcionais no spec, além do pseudocódigo no data-model? [Traceability, Spec §FR-012] — Nota: aceito pós-MVP; RLS é detalhe de implementação, não requisito funcional.
- [x] CHK004 — O requisito de que `points`, `wins` e `losses` não podem ser atualizados diretamente pelo cliente (FR-012) é testável de forma independente e isolada? [Measurability, Spec §FR-012]
- [x] CHK005 — Os limites das funções SECURITY DEFINER (`apply_match_points`, `register_match`, `delete_match`) estão documentados como requisitos de segurança — incluindo quais operações cada uma pode executar e por quê? [Completeness, data-model.md]
- [x] CHK006 — O cenário de tentativa de exclusão por um jogador que não é o criador está especificado como requisito com mensagem de erro definida? [Coverage, Spec §FR-013, Edge Cases] — Nota: aceito pós-MVP; mensagem específica para não-criador é coberta por CHK032.
- [x] CHK007 — Existe requisito para o caso em que `auth.uid()` não corresponde a nenhum perfil na tabela `profiles` (usuário autenticado sem perfil)? [Edge Case, Gap] — Nota: aceito pós-MVP; coberto pelo comportamento definido em CHK024.
- [x] CHK008 — É especificado se o email do jogador é exposto no ranking/matchmaking ou mantido privado? [Clarity, Spec §FR-001, Gap] — Nota: aceito pós-MVP; `plan.md` define que queries públicas não expõem email.

---

## 2. Lógica de Negócio — Rating Elo

- [x] CHK009 — O K-factor (32) está documentado como requisito fixo e testável no spec, não apenas como decisão de pesquisa? [Traceability, research.md, Spec §FR-006]
- [x] CHK010 — Está especificado explicitamente que `points_before` deve refletir a pontuação **no momento exato do registro** (snapshot atômico dentro da transação), prevenindo condições de corrida? [Clarity, Gap]
- [x] CHK011 — Os resultados esperados do Elo para cenários de fronteira (duplas equilibradas → ±16; azarão vence → ±27) estão documentados como critérios de aceitação mensuráveis no spec? [Measurability, research.md, Spec §VI] — Nota: aceito pós-MVP; cenários Elo são testes, não critérios mensuráveis.
- [x] CHK012 — A regra de arredondamento do delta Elo (comportamento de `round()` para .5) está especificada explicitamente — pode impactar a soma de pontos distribuídos? [Clarity, Gap]
- [x] CHK013 — O requisito do piso de pontuação 0 (FR-007) está especificado de forma consistente entre o spec, o data-model (`CHECK points_after >= 0`) e o pseudocódigo RPC (`GREATEST(0, ...)`)? [Consistency, Spec §FR-007]
- [x] CHK014 — Está especificado como o `winner_team` é determinado quando os placares de set são empatados (ex: set 1 ganho pelo time A, set 2 ganho pelo time B — best of sets)? [Clarity, Gap]
- [x] CHK015 — O requisito de que o vencedor do set deve ser derivado server-side (e nunca enviado pelo cliente) está documentado explicitamente como requisito de segurança, além de detalhe técnico? [Clarity, Spec §FR-012, data-model.md]

---

## 3. Lógica de Negócio — Fluxo de Partida & Validação

- [x] CHK016 — A regra de validação de placar (vencedor com 6 ou 7 games; 7 apenas em tiebreak) está especificada de forma idêntica no spec (FR-005a–c), no data-model e nos critérios de aceitação da US1? [Consistency, Spec §FR-005a-c]
- [x] CHK017 — Está definido o comportamento quando o set 2 é fornecido mas o set 1 tem placar inválido — o sistema deve rejeitar ambos ou apenas o set inválido? [Edge Case, Gap]
- [x] CHK018 — Está especificado que o prazo de 5 minutos para exclusão é calculado com base no horário do servidor (não do cliente), prevenindo manipulação? [Clarity, Spec §FR-013, Gap] — Nota: aceito pós-MVP; servidor gera `played_at`, já definido anteriormente.
- [x] CHK019 — Os campos revertidos ao excluir uma partida (`points`, `wins`, `losses`) estão listados explicitamente no spec como requisito, não apenas no pseudocódigo do RPC? [Completeness, Spec §FR-013]
- [x] CHK020 — Está especificado se uma partida excluída deve deixar algum registro de auditoria (para fins de transparência com os jogadores)? [Gap] — Nota: aceito pós-MVP; auditoria de exclusão fica fora do MVP.
- [x] CHK021 — O requisito de unicidade (um jogador não pode aparecer duas vezes na mesma partida) está documentado como requisito funcional no spec além da constraint no data-model? [Traceability, data-model.md UNIQUE (match_id, profile_id)]
- [x] CHK022 — Está especificado o que acontece quando um dos 4 jogadores selecionados para uma partida não existe ou foi removido no momento da submissão? [Edge Case, Gap] — Nota: aceito pós-MVP; no MVP, retornar erro genérico "Jogador não encontrado".

---

## 4. Integridade de Dados — Qualidade dos Requisitos

- [x] CHK023 — Os comportamentos de cascade (ex: `ON DELETE CASCADE` em `match_players`) estão documentados como requisitos de negócio — o que acontece com o histórico se um perfil for deletado? [Completeness, data-model.md, Gap] — Nota: aceito pós-MVP; `ON DELETE CASCADE` já está no schema.
- [x] CHK024 — O requisito de criação automática de perfil via trigger (`handle_new_user`) inclui o comportamento esperado em caso de falha do trigger (ex: rollback do signup)? [Edge Case, Gap]
- [x] CHK025 — A unicidade de `user_id` na tabela `profiles` (um perfil por usuário) está documentada como requisito funcional no spec (além do UNIQUE constraint)? [Traceability, Spec §FR-003, data-model.md]
- [x] CHK026 — O propósito do campo `updated_at` em `profiles` está especificado — é usado para lógica de negócio (ex: ranking) ou apenas para auditoria? [Clarity, Gap] — Nota: aceito pós-MVP; `plan.md` documenta `updated_at` como controle de concorrência.
- [x] CHK027 — Está especificado como a query de ranking lida com empates de pontos em que ambos os jogadores têm `wins + losses = 0` (jogadores novos sem partidas)? [Edge Case, Spec §FR-009]
- [x] CHK028 — Os campos `points_delta` e `points_after` em `match_players` — seus valores iniciais antes da chamada de `apply_match_points` estão documentados como requisito (ex: inicializados com 0 e `points_before`)? [Clarity, data-model.md]

---

## 5. UX & Mobile — Qualidade dos Requisitos

- [x] CHK029 — Estão especificados os estados de carregamento para dados assíncronos (lista do ranking, sugestões de matchmaking, home após registro)? [Completeness, Gap]
- [x] CHK030 — Estão definidos os estados vazios para cenários sem dados (matchmaking sem outros jogadores, ranking com apenas 1 usuário)? [Coverage, Gap]
- [x] CHK031 — O requisito "fluxo executável em até 3 toques" (Princípio III) está detalhado para o fluxo principal (US1) em termos de quais são os 3 toques esperados? [Clarity, Spec §III, Gap] — Nota: aceito pós-MVP; detalhe de UX coberto pelo Princípio III.
- [x] CHK032 — São especificados o conteúdo e o formato das mensagens de erro para cada cenário de rejeição (placar inválido, partida permanente, não-criador tenta excluir)? [Completeness, Gap]
- [x] CHK033 — O requisito de destaque visual da linha do usuário atual no ranking está especificado com critérios mensuráveis (ex: cor, ícone, negrito)? [Clarity, Spec §US2-sc2] — Nota: aceito pós-MVP; detalhe de UI será definido na implementação.

---

## 6. Requisitos Não-Funcionais

- [x] CHK034 — O requisito SC-002 (ranking atualizado em < 2 s) está escopo para condições específicas (ex: quantos usuários concorrentes, tamanho máximo do ranking)? [Clarity, Spec §SC-002] — Nota: aceito pós-MVP; performance detalhada fica pós-MVP.
- [x] CHK035 — Existe requisito de performance para a query de matchmaking, que escala com o total de usuários cadastrados (sem paginação definida)? [Coverage, Gap] — Nota: aceito pós-MVP; performance e paginação ficam pós-MVP.
- [x] CHK036 — O critério SC-001 (< 3 min no celular) está decomposto em sub-etapas mensuráveis (ex: cadastro em X s, registro de partida em Y s)? [Measurability, Spec §SC-001] — Nota: aceito pós-MVP; detalhe de QA, não blocker.
- [x] CHK037 — Existem requisitos de resiliência para falhas do Supabase (ex: indisponibilidade do Auth, timeout de RPC)? [Coverage, Gap] — Nota: aceito pós-MVP; tratar erros genéricos no MVP.

---

## 7. Contratos & Integração — Qualidade dos Requisitos

- [x] CHK038 — Os tipos TypeScript em `contracts/types.ts` (ex: `RegisterMatchPayload`, `MatchPlayerRecord`) estão referenciados no spec ou no plano como contratos autoritativos, de modo que alterações no spec impliquem atualização dos contratos? [Traceability, contracts/types.ts] — Nota: aceito pós-MVP; contratos TypeScript são autoritativos por convenção.
- [x] CHK039 — Está especificado como o frontend deve tratar erros do RPC — por código de erro, mensagem de texto ou status HTTP? [Completeness, Gap] — Nota: aceito pós-MVP; códigos de erro RPC serão definidos durante implementação.
- [x] CHK040 — Está definido o que o cliente recebe em resposta ao `register_match` bem-sucedido (apenas o `match_id`, ou o perfil atualizado, ou o ranking atualizado)? [Clarity, Gap]
- [x] CHK041 — Estão especificados os requisitos para o comportamento do cliente durante o período de exclusão (janela de 5 min) — ex: o botão de exclusão deve aparecer com countdown ou simplesmente sumir após o prazo? [Clarity, Gap]

---

## 8. Completude & Rastreabilidade

- [x] CHK042 — Cada requisito funcional (FR-001 a FR-014) mapeia para ao menos um cenário de aceitação em uma user story? [Traceability, Spec §FR-001–014] — Nota: aceito pós-MVP; cenários de aceitação são cobertos pelos testes definidos nas tasks.
- [x] CHK043 — Os sub-requisitos FR-006a a FR-006g são testáveis de forma independente, ou estão acoplados de modo a impedir validação isolada? [Measurability, Spec §FR-006]
- [x] CHK044 — A regra de desempate do ranking (FR-009 — `wins + losses DESC`) está nos cenários de aceitação da US2 de forma verificável? [Traceability, Spec §FR-009, US2] — Nota: aceito pós-MVP; cenários de aceitação são cobertos pelos testes definidos nas tasks.
- [x] CHK045 — Os itens do escopo excluído ("Fora de Escopo") estão referenciados explicitamente nos critérios de aceitação de cada user story para impedir que sejam implementados inadvertidamente? [Completeness, Spec §Out of Scope] — Nota: aceito pós-MVP; cenários de aceitação são cobertos pelos testes definidos nas tasks.

---

## Notas

- Marque itens concluídos: `[x]`
- Adicione comentários ou gaps encontrados inline (ex: `[x] — gap identificado: adicionar requisito X ao spec`)
- Itens marcados `[Gap]` indicam requisito potencialmente ausente — avalie se é necessário antes de /speckit-tasks
- Itens `[Consistency]` indicam verificação cruzada entre spec, data-model e research
- Resolva ambiguidades críticas no spec antes de avançar para /speckit-tasks
