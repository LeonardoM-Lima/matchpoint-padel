# Full-Spectrum Requirements Checklist: Feed de Jogadas e Notificações Push

**Purpose**: Revisão da qualidade dos requisitos antes da implementação.
**Created**: 2026-05-22
**Audience**: Autor — revisão pré-implementação
**Feature**: [spec.md](../spec.md) | [plan.md](../plan.md) | [data-model.md](../data-model.md)

---

## 1. Upload e Validação de Vídeo

- [ ] CHK201 — Os limites de upload (MP4/MOV/WebM, ≤ 30MB, ≤ 30s) estão idênticos no spec (FR-002, FR-003), no bucket (`file_size_limit`, `allowed_mime_types`) e no client (`VIDEO_UPLOAD_LIMITS`)? [Consistency]
- [ ] CHK202 — Está documentado que a validação de duração só ocorre no client (limitação aceita) e que vídeos > 30s ≤ 30MB serão aceitos pelo Storage? [Clarity, FR-003]
- [ ] CHK203 — O comportamento quando o upload do Storage tem sucesso mas o INSERT em `videos` falha está coberto (rollback do arquivo no Storage)? [Edge Case, plan.md]
- [ ] CHK204 — Vídeo corrompido / sem metadata é rejeitado no client antes do upload? [Edge Case]
- [ ] CHK205 — Está claro que não há transcodificação — vídeos em codecs raros podem não tocar? Mensagem informativa para o usuário? [Risk, research.md §2]

## 2. Feed e Listagem

- [ ] CHK206 — Vídeos com `expires_at <= now()` NÃO aparecem no feed mas continuam visíveis para o próprio autor (policy `videos_select`)? [Consistency, FR-006]
- [ ] CHK207 — A RPC `get_feed` clampia `p_limit` em [1, 50] para evitar abuso (consulta de N grande)? [Risk, data-model.md]
- [ ] CHK208 — Scroll infinito tem mecanismo de parada quando `data.length < p_limit` (não há mais páginas)? [Coverage, FR-006]
- [ ] CHK209 — A data relativa exibida ("há 2 horas") está padronizada via `Intl.RelativeTimeFormat` em pt-BR? [Clarity, FR-007]

## 3. Curtidas e Privacidade

- [ ] CHK210 — RLS de `video_likes` SELECT só retorna linhas do próprio usuário — outros usuários não conseguem ver lista de quem curtiu (FR-011)? [Security, data-model.md]
- [ ] CHK211 — A contagem agregada exposta via `get_feed()` é exata (SECURITY DEFINER bypassa RLS)? Sem isso, COUNT(*) do client retorna apenas 0/1? [Risk, data-model.md]
- [ ] CHK212 — UNIQUE (`video_id`, `profile_id`) impede curtidas duplicadas; toggle usa INSERT/DELETE em vez de upsert? [Consistency, FR-010]
- [ ] CHK213 — Optimistic UI reverte estado em caso de erro de rede; toast discreto é exibido? [UX, plan.md]

## 4. Exclusão de Vídeo

- [ ] CHK214 — Apenas autor consegue excluir (RLS `videos_delete_own`); UI esconde botão de exclusão para não-autores (FR-008)? [Security, Consistency]
- [ ] CHK215 — CASCADE em `video_likes` remove curtidas automaticamente quando o vídeo é apagado? [Coverage, data-model.md]
- [ ] CHK216 — A sequência de operações (Storage delete → DB delete) tem fallback se a segunda falhar — arquivo órfão é limpo pelo cron? [Edge Case, data-model.md]

## 5. Retenção (60 dias)

- [ ] CHK217 — `expires_at` é gerado pelo server (`DEFAULT now() + 60 days`) — cliente não controla a data? [Security, data-model.md]
- [ ] CHK218 — Job de retenção é idempotente — pode rodar 2× sem problema? [Risk]
- [ ] CHK219 — Cleanup chama Edge Function (que tem acesso ao Storage) — não tenta deletar arquivos via SQL puro? [Clarity, data-model.md]
- [ ] CHK220 — `pg_cron` está habilitado e a schedule (`0 3 * * *`) é compatível com fuso UTC do Supabase? [Coverage, research.md §4]

## 6. Web Push: Subscription

- [ ] CHK221 — Detecção de suporte usa `'serviceWorker' in navigator && 'PushManager' in window` (FR-016) — cobre iOS, Safari desktop antigo, browsers exóticos? [Coverage]
- [ ] CHK222 — `endpoint` é UNIQUE globalmente — múltiplas subscriptions do mesmo user em devices diferentes são suportadas (FR-022)? [Consistency, data-model.md]
- [ ] CHK223 — Ao desligar o toggle, sistema chama `subscription.unsubscribe()` no browser ANTES de deletar do banco? Se inverter, browser continua subscrito mas banco perde a key (orfão funcional)? [Edge Case, FR-015]
- [ ] CHK224 — `VAPID_PUBLIC_KEY` é exposta como variável pública (necessária); `VAPID_PRIVATE_KEY` está em secrets (nunca no client)? [Security, research.md §8]
- [ ] CHK225 — Tooltip explicativo aparece quando browser não suporta push, com instruções claras? [UX, FR-016]

## 7. Web Push: Edge Function

- [ ] CHK226 — Edge Function valida `Authorization: Bearer SERVICE_ROLE_KEY` antes de processar — bloqueia chamadas diretas do client? [Security, research.md §15]
- [ ] CHK227 — Subscriptions com statusCode 410/404 são removidas automaticamente do banco (FR-019)? [Coverage]
- [ ] CHK228 — Promise.allSettled garante que falha em um envio não interrompe os demais? [Consistency, plan.md]
- [ ] CHK229 — Função usa `web-push@3.6.7` via ESM (esm.sh) — versão pinada para evitar breaking changes? [Risk]

## 8. Push em eventos (register_match v3 + trigger de liga)

- [ ] CHK230 — Push de partida dispara APENAS para participantes não-criadores via `register_match` v3 (não trigger granular em `match_players`)? [Consistency, data-model.md]
- [ ] CHK231 — Push de ranking usa snapshot de `points_before`/`wins_before`/`losses_before` reconstruído dos `match_players` desta partida, para evitar contaminação com valores já atualizados dos outros 3 jogadores? [Risk, data-model.md]
- [ ] CHK231a — Push de ranking dispara APENAS quando o jogador participou da partida — não quando partidas alheias mudam posição relativa? [Consistency, data-model.md]
- [ ] CHK232 — Trigger de liga ignora autoadição do dono em `create_league` (FR-017c)? [Consistency, data-model.md]
- [ ] CHK233 — `enqueue_push_notification` filtra perfis com subscription ativa antes de chamar HTTP — economiza calls quando ninguém tem push? [Risk, data-model.md]
- [ ] CHK234 — Função `enqueue_push_notification` usa `SECURITY DEFINER` com `SET search_path = public` (boa prática Supabase)? [Security]
- [ ] CHK234a — `enqueue_push_notification` NÃO tem GRANT EXECUTE para `authenticated` — chamada apenas via outras SECURITY DEFINER (register_match v3, trigger de liga)? [Security]
- [ ] CHK235 — `app.edge_function_url` e `app.edge_function_key` estão em database settings, não hardcoded? [Risk, quickstart.md §2]
- [ ] CHK236 — `pg_net.http_post` é assíncrono — não trava o `register_match` aguardando push delivery (FR-018)? [Performance]
- [ ] CHK236a — Edge Function `send-push-notification` tem guard para `profile_ids: []` retornando `{sent:0, dead:0}` sem erro? [Risk, plan.md]
- [ ] CHK236b — `cleanup_expired_videos` envia UMA chamada HTTP em lote para todos os vídeos expirados (não N chamadas)? [Performance, research.md §16]

## 9. Service Worker e Client

- [ ] CHK237 — `public/sw.js` é servido com `Content-Type: application/javascript` (configuração de host)? [Risk, quickstart.md §10]
- [ ] CHK238 — Handler `notificationclick` chama `event.notification.close()` e `openWindow(data.url)`? [Coverage, research.md §12]
- [ ] CHK239 — Tag de notificação previne duplicatas (mesma partida não vira 2 notificações se trigger disparar 2×)? [Consistency, FR-020]

## 10. Mensagens de Erro & UX

- [ ] CHK240 — Todas as mensagens de erro do FR-012 são exibidas via `ErrorBanner` ou `toast` consistentes com features anteriores? [Consistency]
- [ ] CHK241 — Estado vazio do feed tem CTA para publicar (engajamento)? [UX, US2 Acceptance 2]
- [ ] CHK242 — Loading do upload mostra progresso (não bloqueia UI)? [UX]

## 11. Testes

- [ ] CHK243 — Os testes do research §13 estão presentes em `tests/integration/` (feed, video-likes, push-subscriptions, push-events)? [Traceability, research.md §13]
- [ ] CHK244 — Há teste explícito de privacidade (CHK210): user B falha ao tentar ler likes de A? [Security, FR-011]
- [ ] CHK244a — Há teste de cenário 0×0 do ranking (Elo da liga não dispara push errado quando todos têm 0 pts iniciais)? [Coverage]
- [ ] CHK245 — Há teste de regressão garantindo que MVP e feature 002 continuam funcionando (RLS, RPCs); especificamente, `register_match` v3 mantém a mesma semântica de v2 + adiciona push (depende da feature 002 estar deployada)? [Coverage]
- [ ] CHK245a — Há teste cronometrado de SC-005 — Edge Function recebe 410 simulado, verifica que a linha de `push_subscriptions` desaparece na MESMA execução (sem polling)? [Measurability, SC-005]

## 12. Compatibilidade

- [ ] CHK246 — iOS < 16.4 / browsers antigos têm UX clara (toggle desabilitado, mensagem)? [Coverage, FR-016]
- [ ] CHK247 — PWA está documentado como pré-requisito para push em iOS (Adicionar à tela inicial)? [Risk, research.md §7]
- [ ] CHK248 — Vídeos em codecs HEVC ou outros raros têm mensagem informativa quando não tocam? [Risk, research.md §2]

---

## Notas

- Marque itens concluídos: `[x]`
- Adicione comentários ou gaps inline
- Itens marcados `[Gap]`, `[Risk]`, `[Security]` precisam ser endereçados
  antes da implementação
- Resolver ambiguidades antes de iniciar
