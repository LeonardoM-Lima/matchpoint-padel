<!--
Sync Impact Report
==================
Version change: NEW → 1.0.0 (initial ratification)
Modified principles: N/A — initial creation
Added sections:
  - Core Principles I through VII
  - Additional Constraints
  - Development Workflow
  - Governance
Removed sections: N/A
Templates requiring updates:
  ✅ .specify/memory/constitution.md (this file — written)
  ✅ .specify/templates/plan-template.md (Constitution Check is dynamic; no static refs to update)
  ✅ .specify/templates/spec-template.md (aligned with Principle II: Spec as Source of Truth)
  ✅ .specify/templates/tasks-template.md (test tasks align with Principle VI; no changes needed)
Follow-up TODOs: None — all placeholders resolved.
-->

# MatchPoint Padel Constitution

## Core Principles

### I. Simplicidade Acima de Complexidade (NON-NEGOTIABLE)

O MVP MUST entregar apenas o fluxo principal. Funcionalidades fora do escopo —
ligas privadas, feed social, IA, antifraude avançado, pagamentos e push
notifications — MUST ser rejeitadas sem exceção. Qualquer adição de
funcionalidade MUST demonstrar que não compromete o core flow antes de ser
aprovada.

**Rationale**: Validar o produto rapidamente com jogadores reais antes de
investir em complexidade desnecessária.

### II. Spec Como Fonte da Verdade (NON-NEGOTIABLE)

Toda funcionalidade MUST seguir a spec vigente. Em conflito entre código e
spec, a spec vence sem exceção. Mudanças de produto MUST atualizar a spec
antes de qualquer alteração no código.

**Rationale**: Evita drift entre intenção e implementação, mantendo alinhamento
entre produto e engenharia.

### III. Mobile-First

Toda tela MUST ser projetada primeiro para celular (viewport ≤ 390 px). Fluxos
principais MUST ser executáveis em até 3 toques a partir da tela inicial.
Desktop é suportado como layout progressivamente aprimorado.

**Rationale**: O público-alvo usa o app em quadra, frequentemente com uma mão
ocupada e sob pressão de tempo.

### IV. Fluxo Principal Protegido (NON-NEGOTIABLE)

O núcleo **cadastro/login → registrar partida → salvar resultado → atualizar
ranking** MUST permanecer funcional em toda release. Funcionalidades secundárias
MUST NOT bloquear ou degradar esse caminho em qualquer build enviado para
staging ou produção.

**Rationale**: Quebrar o core flow invalida o produto para todos os usuários.

### V. Segurança Básica Obrigatória

- Rotas autenticadas MUST exigir usuário válido (Supabase Auth).
- Usuário MUST NOT alterar dados de outros usuários diretamente via API ou
  cliente.
- Pontuação MUST ser atualizada apenas por lógica centralizada (RPC / Edge
  Function controlada), nunca por `UPDATE` direto do cliente.
- Dados enviados pelo frontend MUST ser validados no backend ou via RLS antes
  de persistência.

**Rationale**: Protege a integridade do ranking e previne manipulação de
resultados.

### VI. Testes de Regras Críticas (NON-NEGOTIABLE)

Testes MUST cobrir: cálculo de pontuação, criação de partida, atualização de
ranking e autenticação. Testes de integração SHOULD ser priorizados sobre
unitários nos fluxos principais. Nenhuma PR que toque lógica de ranking ou
autenticação MUST ser mergeada sem cobertura de teste correspondente.

**Rationale**: As regras de negócio do ranking são o diferencial do produto;
regressões silenciosas destruiriam a confiança dos usuários.

### VII. Integridade de Dados

Toda partida persistida MUST conter: participantes (mínimo 2), placar (ambos
os lados) e data. Pontuação MUST ter valor mínimo de 0. Duplicação de registros
de partida SHOULD ser prevenida via constraints no banco ou validação de
idempotência no backend.

**Rationale**: Dados inconsistentes corrompem o ranking e são difíceis de
reverter após acumulação.

## Additional Constraints

- **Stack**: React + Vite + TypeScript (web) com path para React Native
  reutilizando `services/`, `hooks/` e `contexts/`. Backend via Supabase
  (Auth, PostgreSQL, RLS, Edge Functions/RPCs).
- Microserviços e camadas de abstração desnecessárias MUST NOT ser criados no
  MVP.
- Lógica de negócio crítica (ranking, pontuação) MUST residir em funções
  controladas no Supabase, não no cliente.

## Development Workflow

- PRs MUST ser revisados quanto à aderência a esta constituição antes do merge.
- Qualquer violação de princípio MUST ser documentada e justificada na seção
  **Complexity Tracking** do plano de implementação correspondente.
- Amendments seguem semver: MAJOR para remoção ou redefinição de princípio,
  MINOR para nova seção ou princípio, PATCH para clarificações e correções de
  redação.

## Governance

Esta constituição é o documento normativo supremo do projeto MatchPoint Padel.
Ela MUST ser consultada em cada revisão de PR e em cada ciclo de planejamento.
Em caso de conflito com qualquer outro documento, esta constituição prevalece,
exceto quando um amendment formal tiver sido ratificado e registrado abaixo.

Amendments requerem: (a) proposta escrita com justificativa, (b) revisão de
impacto nos templates dependentes, e (c) atualização do número de versão
conforme semver definido em **Development Workflow**.

**Version**: 1.0.0 | **Ratified**: 2026-05-03 | **Last Amended**: 2026-05-04
