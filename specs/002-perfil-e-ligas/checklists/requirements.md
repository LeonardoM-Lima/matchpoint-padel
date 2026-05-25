# Full-Spectrum Requirements Checklist: Perfil e Ligas Privadas

**Purpose**: Revisão da qualidade dos requisitos antes de iniciar a implementação.
**Created**: 2026-05-22
**Audience**: Autor — revisão pré-implementação
**Feature**: [spec.md](../spec.md) | [plan.md](../plan.md) | [data-model.md](../data-model.md)

---

## 1. Storage & Upload de Imagens

- [ ] CHK101 — Os limites de upload (formatos JPG/PNG/WebP, ≤ 2MB) estão especificados de forma idêntica no spec (FR-004), no data-model (`file_size_limit=2097152`, `allowed_mime_types`) e no client (`IMAGE_UPLOAD_LIMITS`)? [Consistency, FR-004]
- [ ] CHK102 — Há requisito explícito do que acontece quando o upload falha após o `INSERT` do path no `profiles.avatar_url` (estado inconsistente)? [Edge Case, Gap]
- [ ] CHK103 — Está documentado que `avatar_url` armazena path relativo (não URL completa) e que a URL pública é gerada on-demand? [Clarity, research.md §2]
- [ ] CHK104 — O comportamento do fallback (sem foto = avatar com iniciais) está cobertode UI em todas as telas que exibem avatar (ranking, matchmaking, perfil, histórico, liga)? [Completeness, FR-003, FR-008]
- [ ] CHK105 — Está especificado se a deleção de um perfil remove o avatar do Storage (ou apenas a referência no banco)? [Edge Case, Gap]

## 2. Categoria do Perfil

- [ ] CHK106 — Os valores enumerados de `player_category` no spec (FR-006) batem com o ENUM PostgreSQL no data-model? [Consistency, FR-006]
- [ ] CHK107 — Está claro que categoria não afeta Elo, matchmaking nem ranking — é apenas cosmética? [Clarity, FR-007]
- [ ] CHK108 — Há requisito para extensão futura do ENUM (adicionar novas categorias)? [Coverage, Gap] — Nota: aceito pós-feature; `ALTER TYPE ADD VALUE` resolve.

## 3. Ligas — Lifecycle

- [ ] CHK109 — Os limites de nome (3–40 caracteres) estão especificados de forma testável e idêntica entre spec (FR-010), CHECK do banco e validação client? [Consistency, FR-010]
- [ ] CHK110 — Está especificado o comportamento quando o dono é deletado do sistema (CASCADE em `leagues.owner_id`)? [Edge Case, data-model.md]
- [ ] CHK111 — A exclusão de liga preservar partidas históricas com `league_id = NULL` (FR-028) está testável e cobre o caso onde `match_league_players` tem CASCADE (já que a liga não existe mais)? [Consistency, FR-028]
- [ ] CHK112 — Existe requisito sobre o que acontece com um participante removido em uma liga que tem partidas vinculadas a ele (histórico permanece, mas ranking não exibe)? [Edge Case, Edge Cases §spec]

## 4. Membros e Permissões

- [ ] CHK113 — Está especificado que apenas o dono pode adicionar/remover (FR-012) e que o RPC valida via `auth.uid()` (defesa em profundidade)? [Traceability, FR-012, data-model.md]
- [ ] CHK114 — Tentativa de adicionar jogador já participante (FR-014) tem mensagem específica documentada? [Completeness, FR-029]
- [ ] CHK115 — Self-remove está coberto como exceção explícita à regra "apenas dono pode remover" (qualquer participante pode sair, exceto o dono)? [Clarity, data-model.md `remove_league_member`]
- [ ] CHK116 — Está documentado que dono não pode self-remove (deve excluir a liga) e que a UI sugere a alternativa? [Edge Case, Acceptance Scenario US3.5]

## 5. Vínculo Partida ↔ Liga

- [ ] CHK117 — A regra "todos os 4 jogadores devem ser participantes" é validada server-side (FR-023) E client-side (dropdown filtrado, FR-021)? [Consistency, Defense in depth]
- [ ] CHK118 — Está especificado que o vínculo é opcional (estado padrão = "Nenhuma") e que partidas sem vínculo continuam atualizando apenas o ranking global? [Clarity, FR-024]
- [ ] CHK119 — O cálculo Elo da liga usa base própria (`league_points_before`) e mesma K-factor que o global — está documentado e tem teste de regressão? [Traceability, FR-024, research.md §5]
- [ ] CHK120 — A atomicidade do registro vinculado (rollback se qualquer um dos 5 passos falhar — match, match_leagues, match_league_players, apply_match_points global, apply_match_points liga) está testável? [Measurability, FR-025]
- [ ] CHK121 — Reversão de `delete_match` cobre ambas as dimensões (global + liga) em uma única transação atômica? [Consistency, FR-026]
- [ ] CHK122 — Está especificado o que acontece quando o dropdown não carrega (erro de RPC `get_eligible_leagues_for_match`)? [Edge Case, Gap]

## 6. RLS & Segurança

- [ ] CHK123 — Não-participantes são bloqueados de ler `leagues`, `league_players`, `match_leagues`, `match_league_players` via policies SELECT? [Coverage, data-model.md]
- [ ] CHK124 — Storage policies para `avatars` validam o path (`(storage.foldername(name))[1] = auth.uid()::text`) — está claro que isso impede usuário B de sobrescrever pasta de A? [Clarity, research.md §8]
- [ ] CHK125 — Storage para `league-covers` usa `is_league_owner(uuid)` para validar dono, impedindo usuário B de subir capa para liga de A. Path inválido (não-UUID) falha no cast. [Risk, data-model.md]
- [ ] CHK126 — `points`, `wins`, `losses` em `league_players` continuam bloqueados para UPDATE direto pelo cliente (apenas via RPC SECURITY DEFINER)? [Consistency, MVP §FR-012 estendido]
- [ ] CHK126a — Policies de RLS em `league_players`, `match_leagues` e `match_league_players` usam helpers SECURITY DEFINER (`is_league_member`, `is_league_owner`) para evitar recursão. Sem helpers, SELECT em tabelas com policy auto-referente trava com erro. [Risk, research.md §13]

## 7. UX & Mobile

- [ ] CHK127 — A categoria coexiste com o nível no perfil sem confusão visual (badge separado, label claro)? [Clarity, FR-007]
- [ ] CHK128 — Estado de loading durante upload de foto (spinner ou progress) está coberto? [Completeness, Gap]
- [ ] CHK129 — Empty states cobrem: sem ligas; busca sem resultados; ranking interno com 1 participante? [Coverage, FR-030]
- [ ] CHK130 — Dropdown de liga na tela de partida tem comportamento claro (disabled até 4 jogadores; mensagem se nenhuma elegível)? [Clarity, FR-022]

## 8. Performance

- [ ] CHK131 — Transformações on-the-fly do Storage têm fallback se Supabase free tier não suportar (cache CDN local)? [Risk, research.md §10]
- [ ] CHK132 — Query "minhas ligas" suporta listagem sem paginação para 5–50 ligas — ok no MVP? [Coverage, plan.md] — Nota: aceito; paginação pós-feature.
- [ ] CHK133 — Ranking interno renderiza com `RANK` calculado no client; performance OK até 100 membros? [Risk, plan.md] — Nota: aceito; ligas devem ser pequenas no início.

## 9. Mensagens de Erro

- [ ] CHK134 — Todas as 6 mensagens de erro (FR-029) são exibidas via componente único (`ErrorBanner`) reutilizando o MVP? [Consistency, FR-029]
- [ ] CHK135 — Erro de RPC retorna código distinguível (ex: `LEAGUE_DELETE_FORBIDDEN`) para o frontend mapear, ou apenas mensagem em string? [Clarity, Gap]

## 10. Testes

- [ ] CHK136 — 8 testes de integração documentados em research.md §11 estão presentes em `tests/integration/` — Storage, Leagues, Match-League? [Traceability, research.md §11]
- [ ] CHK137 — Há teste de regressão garantindo que comportamento sem `league_id` é idêntico ao MVP (não quebrou nada)? [Coverage, plan.md]

---

## Notas

- Marque itens concluídos: `[x]`
- Adicione comentários ou gaps inline (ex: `[x] — gap: adicionar requisito X`)
- Itens marcados `[Gap]` indicam requisito potencialmente ausente
- Resolver ambiguidades antes de iniciar a implementação
