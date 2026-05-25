# Quickstart: Feed de Jogadas e Notificações Push

## Pré-requisitos

Mesmos do MVP e da feature 002, mais:
- Supabase CLI atualizada (`supabase --version` ≥ 1.150) com suporte a
  Edge Functions e `pg_cron`.
- `web-push` CLI para gerar VAPID keys (one-time).

---

## 1. Gerar VAPID keys (one-time)

As VAPID keys são necessárias para o servidor de push autenticar com
Mozilla/Google/Apple. **Gere uma vez** e armazene como secrets — não
recommit em git.

```bash
npx web-push generate-vapid-keys
# =======================================
# Public Key:
# BJxC...   (use no client)
#
# Private Key:
# K7n...    (use no Edge Function)
# =======================================
```

Anote ambas — você vai usá-las nos próximos passos.

---

## 2. Variáveis de ambiente

### Client (`.env.local`)

```env
# Adicione ao existente:
VITE_VAPID_PUBLIC_KEY=BJxC...
```

### Edge Functions (secrets)

```bash
supabase secrets set VAPID_PUBLIC_KEY=BJxC...
supabase secrets set VAPID_PRIVATE_KEY=K7n...
supabase secrets set VAPID_SUBJECT=mailto:contato@matchpoint.app
```

### Database (variáveis Postgres usadas pelos triggers)

```bash
# Local dev
psql "$DATABASE_URL" <<SQL
ALTER DATABASE postgres SET app.edge_function_url = 'http://host.docker.internal:54321/functions/v1';
ALTER DATABASE postgres SET app.edge_function_key = '<SUPABASE_SERVICE_ROLE_KEY local>';
SQL

# Produção (após criar projeto hosted)
psql "$DATABASE_URL_PROD" <<SQL
ALTER DATABASE postgres SET app.edge_function_url = 'https://<project-ref>.supabase.co/functions/v1';
ALTER DATABASE postgres SET app.edge_function_key = '<service_role_key>';
SQL
```

> **Atenção**: a service_role key é sensível. Mantenha apenas nas variáveis
> do banco (acessíveis ao `postgres` user) e em secrets do Supabase. Nunca
> exponha no client.

---

## 3. Aplicar migrations e Edge Function

```bash
# Migrations
supabase start
supabase db push

# Edge Function
supabase functions deploy send-push-notification
# (ou em dev local)
supabase functions serve send-push-notification
```

### Habilitar extensões necessárias

```sql
-- No primeiro setup, garantir que as extensões estejam habilitadas
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

> O Supabase hosted já vem com ambas habilitadas no plano Pro. No local
> Supabase (Docker) também vem por padrão.

---

## 4. Iniciar o frontend

```bash
pnpm dev
# Disponível em http://localhost:5173
```

---

## 5. Executar testes da feature

```bash
# Específicos
pnpm test tests/integration/feed.test.ts
pnpm test tests/integration/video-likes.test.ts
pnpm test tests/integration/push-subscriptions.test.ts
pnpm test tests/integration/push-triggers.test.ts

# Suite completa (mantém regressão das features 001 e 002)
pnpm test
```

---

## 6. Validar fluxos principais

### 6.1 Publicar e visualizar vídeo (US1 + US2)

1. Login com um jogador
2. Acessar **"Feed"** no menu inferior
3. Clicar em **"Publicar vídeo"**
4. Selecionar um MP4 ≤ 30s e ≤ 30MB; informar título e categoria
5. Aguardar upload — vídeo aparece no topo do feed
6. Logar com outro usuário e confirmar que o vídeo aparece para ele também

> **Critério (SC-001)**: upload < 15s em 4G estável.
> **Critério (SC-002)**: feed inicial < 2s.

### 6.2 Curtir/Descurtir (US3)

1. No feed, tocar no coração de um vídeo
2. Contagem aumenta em +1; ícone fica preenchido
3. Tocar novamente: -1, ícone vazio
4. Atualizar a tela e confirmar que o estado persiste

### 6.3 Excluir próprio vídeo (US4)

1. Abrir um vídeo de sua autoria
2. Clicar no menu (3 pontos) → "Excluir"
3. Confirmar — vídeo desaparece em < 3s
4. Logar com outro user e confirmar que o vídeo sumiu para todos

### 6.4 Ativar e receber push (US5 + US6)

1. Ir em **Perfil** → ativar **"Notificações push"**
2. Aceitar a permissão do navegador
3. Em outra sessão, fazer outro user **registrar uma partida** incluindo
   o primeiro user
4. O primeiro user recebe push do SO em ≤ 10s
5. Clicar na notificação → app abre em `/profile/history`

> **Critério (SC-003)**: push entrega em < 10s.

### 6.5 Testar todos os 3 eventos de push

| Evento | Como disparar | Push esperado |
|--------|--------------|--------------|
| Partida registrada | Outro user inclui você em uma partida | "Nova partida registrada — você ganhou/perdeu X pontos" |
| Mudança de ranking ≥ 3 | Registrar várias partidas até a posição mover 3+ | "Você subiu/caiu no ranking — De Xº para Yº" |
| Convite para liga | Dono adiciona você a uma liga (feature 002) | "Convite para liga — Você foi adicionado à liga 'Nome'" |

---

## 7. Supabase Studio — queries úteis

```sql
-- Vídeos ativos
SELECT v.id, p.name AS author, v.title, v.category,
  v.created_at, v.expires_at,
  (SELECT count(*) FROM video_likes WHERE video_id = v.id) AS likes
FROM videos v
JOIN profiles p ON p.id = v.author_id
WHERE v.expires_at > now()
ORDER BY v.created_at DESC;

-- Subscriptions ativas
SELECT ps.id, p.name AS user, ps.user_agent, ps.created_at
FROM push_subscriptions ps
JOIN profiles p ON p.id = ps.profile_id
ORDER BY ps.created_at DESC;

-- Fila de chamadas HTTP pendentes (pg_net)
SELECT * FROM net.http_request_queue LIMIT 20;
SELECT * FROM net._http_response WHERE created > now() - interval '1 hour';

-- Próxima execução do cron de retenção
SELECT jobname, schedule, command, nodename, active
  FROM cron.job WHERE jobname = 'cleanup-expired-videos';

-- Forçar execução manual do cleanup (útil em dev)
SELECT cleanup_expired_videos();
```

---

## 8. Cenários de falha esperados (negative testing)

| Cenário | Resultado esperado |
|---------|-------------------|
| Upload de AVI / FLV | Rejeitado no client (MIME type não permitido) |
| Upload > 30MB | Rejeitado pelo bucket |
| Upload > 30s (mas ≤ 30MB) | Rejeitado pelo client (`<video>.duration`) |
| Vídeo corrompido (sem metadata) | Rejeitado pelo client com mensagem genérica |
| Curtir vídeo recém-excluído | RLS / FK rejeita; UI reverte estado |
| Push sem permissão | Toggle não ativa, mensagem explicativa |
| Push em iOS < 16.4 | Toggle desabilitado com tooltip |
| Subscription expirada | Edge Function detecta 410/404 e deleta automaticamente |
| Apagar vídeo de outro user | RLS rejeita DELETE |

---

## 9. Estrutura de migrations adicionada

> **Ordem crítica**: 020 (extensões) precisa rodar antes de qualquer
> migration que use `pg_net`/`pg_cron`. 026 (helper) antes de 027/028/029
> (que chamam `enqueue_push_notification`).

```
supabase/migrations/
├── 020_extensions_and_settings.sql       # CREATE EXTENSION pg_net + pg_cron
├── 021_create_videos.sql                 # ENUM video_category + tabela videos
├── 022_create_video_likes.sql            # tabela video_likes + UNIQUE
├── 023_create_push_subscriptions.sql     # tabela push_subscriptions
├── 024_feed_rls_policies.sql             # RLS em videos, video_likes, push_subs
├── 025_feed_rpcs.sql                     # get_feed + get_my_videos (SECURITY DEFINER)
├── 026_push_notification_helpers.sql     # enqueue_push_notification
├── 027_register_match_v3.sql             # DROP v2 + CREATE v3 com push interno
├── 028_league_push_trigger.sql           # trigger AFTER INSERT em league_players
├── 029_cleanup_expired_videos.sql        # função + pg_cron schedule (lote único)
└── 030_storage_videos_bucket.sql         # bucket videos + policies
```

---

## 10. Deploy (produção)

```bash
# Aplicar migrations
supabase db push --project-ref <project-ref>

# Deploy da Edge Function
supabase functions deploy send-push-notification --project-ref <project-ref>

# Configurar secrets (one-time)
supabase secrets set --project-ref <project-ref> \
  VAPID_PUBLIC_KEY=BJxC... \
  VAPID_PRIVATE_KEY=K7n... \
  VAPID_SUBJECT=mailto:contato@matchpoint.app

# Configurar variáveis de database (via SQL no painel)
ALTER DATABASE postgres SET app.edge_function_url = 'https://<project-ref>.supabase.co/functions/v1';
ALTER DATABASE postgres SET app.edge_function_key = '<service_role_key>';

# Build + deploy do client
pnpm build
vercel deploy --prod
# Variáveis de env no painel da Vercel:
# - VITE_SUPABASE_URL
# - VITE_SUPABASE_ANON_KEY
# - VITE_VAPID_PUBLIC_KEY
```

> **Service Worker — checklist de deploy**:
>
> 1. O arquivo MUST ficar em `public/sw.js` no projeto Vite. Vite copia
>    `public/*` para a raiz do build. Resultado final: `https://app/sw.js`.
> 2. O scope é determinado pelo path do arquivo. `/sw.js` → scope = `/`
>    (captura todas as rotas). Se ficar em `/static/sw.js`, scope =
>    `/static/` (não captura `/feed`, `/ranking`, etc).
> 3. Host MUST servir com `Content-Type: application/javascript` (Vercel,
>    Netlify, Cloudflare Pages e GitHub Pages fazem isso automaticamente
>    para `.js`).
> 4. Em DEV (Vite), o SW é servido em `/sw.js` corretamente. Verifique
>    DevTools → Application → Service Workers → "Scope: /".
> 5. **Não** adicionar headers `Service-Worker-Allowed` — só necessário
>    se quiser scope FORA do path do arquivo (não é o caso aqui).
> 6. Após deploy, force o SW antigo a atualizar via DevTools "Update on
>    reload" durante teste manual. Em produção, atualização é automática
>    quando o byte do arquivo muda.
