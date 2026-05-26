# Research: Feed de Jogadas e Notificações Push

**Branch**: `003-feed-e-push` | **Date**: 2026-05-22

## Decisions

### 1. Storage de vídeos: Supabase Storage no bucket `videos`

**Decision**: Reusar Supabase Storage, criar bucket `videos` com mesma
estratégia de path por user (`{user_id}/{uuid}.mp4`).

**Limites adotados**:
- `file_size_limit`: 31_457_280 (30 MB)
- `allowed_mime_types`: `['video/mp4', 'video/quicktime', 'video/webm']`
- Bucket público para leitura (qualquer authenticated reproduz)

**Rationale**:
- Mantém a integração já estabelecida na feature 002. Sem provider novo.
- Free tier do Supabase: 1GB storage + 2GB bandwidth/mês. Com 30MB médios
  por vídeo, dá ~30 vídeos no free tier. Para validação inicial é suficiente.
- Migrar para Cloudflare R2 quando volume crescer (bandwidth gratuito).

**Alternatives considered**:
- **Cloudflare R2**: Bandwidth gratuito + 10GB storage gratuito. Melhor a
  longo prazo, mas adiciona segundo provider e setup. Adiar.
- **Cloudflare Stream / Mux**: Transcodificação automática, HLS, thumbnails.
  Pago desde o início (~$1/1000 min de armazenamento). Sobre-engineering
  para MVP.
- **YouTube embed**: Custo zero mas obriga jogador a postar publicamente no
  YouTube. UX terrível para um app de padel.

---

### 2. Sem transcodificação no MVP

**Decision**: Aceitar o vídeo como uploaded; reproduzir via `<video>` HTML5.

**Rationale**:
- Navegadores modernos (Chrome/Firefox/Safari/Edge ≥ 2023) tocam MP4 (H.264),
  MOV (H.264) e WebM (VP8/VP9) nativamente.
- Transcodificação requer infra dedicada (FFmpeg em worker, Mux, AWS
  MediaConvert) — viola Princípio I.
- Trade-off: vídeos gravados em codecs obscuros (HEVC sem HW decode no
  navegador) podem não tocar. **Aceito como compromisso do MVP**.

**Mitigação UX**: incluir aviso na tela de upload: "Para melhor compatibilidade
use o gravador do seu celular em formato padrão (MP4)".

---

### 3. Validação de duração: client-side via `<video>.duration`

**Decision**: Validar duração antes do upload usando elemento `<video>` oculto.

```ts
async function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };
    video.onerror = () => reject(new Error('Vídeo corrompido'));
    video.src = URL.createObjectURL(file);
  });
}
```

**Limitação aceita**: usuário malicioso pode contornar e enviar vídeo > 30s
desde que ≤ 30MB. Storage não impõe duração; só tamanho. **Não é vetor
crítico** — vídeos grandes (>30s e <30MB) gastam mais bandwidth mas não
quebram o sistema.

---

### 4. Retenção de 60 dias via `pg_cron`

**Decision**: Job diário Postgres executa função `cleanup_expired_videos()`
às 03:00 UTC.

**Rationale**:
- `pg_cron` é extensão padrão do Supabase, não exige infra externa.
- Função roda como `service_role`, contornando RLS para acessar todas as
  linhas.
- Para cada vídeo expirado: deleta o arquivo do Storage via
  `supabase.storage.from('videos').remove([path])` chamado pela Edge
  Function (pg_cron → pg_net → Edge Function), depois `DELETE FROM videos`
  (CASCADE limpa `video_likes`).

```sql
-- Migration 020 (sequência após 019 da feature 002)
SELECT cron.schedule(
  'cleanup-expired-videos',
  '0 3 * * *',  -- 03:00 UTC todo dia
  $$ SELECT cleanup_expired_videos() $$
);
```

**Trade-off de simplicidade**: chamar Edge Function para delete do Storage é
duas etapas (`pg_net` → função). Alternativa: usar a Storage API HTTP
diretamente do `pg_net`, mas isso espalha credenciais no banco. Edge
Function centraliza autorização.

**Edge Function `cleanup-video`** (recebe lote de vídeos para remover):

```ts
// supabase/functions/cleanup-video/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

interface CleanupItem {
  video_id: string;
  storage_path: string;
}

Deno.serve(async (req) => {
  if (req.headers.get("authorization") !==
      `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { items } = (await req.json()) as { items: CleanupItem[] };
  if (!Array.isArray(items) || items.length === 0) {
    return new Response(JSON.stringify({ removed: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Remove arquivos do Storage em lote (mais eficiente que N requests)
  const paths = items.map(i => i.storage_path);
  const { error: storageErr } = await supabase.storage
    .from("videos").remove(paths);
  if (storageErr) {
    console.error("Storage remove failed:", storageErr);
    // Continua: arquivo pode ter sido removido manualmente, ainda apagamos a linha
  }

  // DELETE em lote (CASCADE limpa video_likes)
  const ids = items.map(i => i.video_id);
  const { error: dbErr } = await supabase
    .from("videos").delete().in("id", ids);

  return new Response(
    JSON.stringify({ removed: dbErr ? 0 : items.length, error: dbErr?.message }),
    { headers: { "Content-Type": "application/json" }, status: dbErr ? 500 : 200 },
  );
});
```

**Por que receber lote**: ver §16 abaixo (decisão de batching para o
cleanup).

---

### 16. Batching do cleanup diário

**Decision**: `cleanup_expired_videos()` envia **uma única chamada** para a
Edge Function `cleanup-video` com a lista completa de vídeos expirados,
em vez de N chamadas (uma por vídeo).

**Rationale**:
- Para uma base de 1000 vídeos expirando no dia, N chamadas =
  N requests `pg_net` enfileirados (limite configurável, ~1000 default) +
  N invocações de Edge Function (custo de cold start).
- Lote único: 1 request `pg_net`, 1 invocação Edge Function, 1 chamada
  `storage.remove(paths[])`, 1 `DELETE FROM videos WHERE id IN (...)`.

**Implementação atualizada da função SQL**:

```sql
CREATE OR REPLACE FUNCTION cleanup_expired_videos()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_items jsonb;
  v_count int;
BEGIN
  SELECT jsonb_agg(jsonb_build_object(
           'video_id', id,
           'storage_path', storage_path
         )), count(*)
    INTO v_items, v_count
    FROM videos
   WHERE expires_at <= now();

  IF v_count = 0 OR v_items IS NULL THEN
    RETURN 0;
  END IF;

  PERFORM net.http_post(
    url := current_setting('app.edge_function_url') || '/cleanup-video',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.edge_function_key'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('items', v_items)
  );

  RETURN v_count;
END;
$$;
```

**Limite prático**: jsonb pode ficar muito grande. Para > 5000 vídeos,
chunkear em batches de 1000. Para o MVP (até 1000 vídeos/dia esperado),
um único lote é suficiente. Pós-MVP, adicionar chunking se necessário.

---

### 5. Curtidas: tabela simples + view de contagem

**Decision**: Tabela `video_likes (video_id, profile_id, created_at)` com
`UNIQUE (video_id, profile_id)` + view agregada `video_likes_count`.

**Rationale**:
- Toggle simples: INSERT/DELETE conforme estado.
- Contagem para o feed via JOIN agregado (LEFT JOIN + COUNT) ou tabela
  materializada — view normal já basta no MVP (até 10k linhas).
- Privacidade: RLS de `video_likes` permite SELECT apenas das linhas onde
  `profile_id = current_user.profile_id`. Outros usuários **não conseguem
  ver quem curtiu** — apenas a contagem agregada (que é pública via view).

```sql
-- Policy: usuário só vê suas próprias curtidas
CREATE POLICY video_likes_select_own ON video_likes
  FOR SELECT TO authenticated
  USING (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- INSERT/DELETE: só na própria curtida
CREATE POLICY video_likes_insert_own ON video_likes
  FOR INSERT TO authenticated
  WITH CHECK (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY video_likes_delete_own ON video_likes
  FOR DELETE TO authenticated
  USING (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));
```

**Contagem pública via view com SECURITY INVOKER** (default):
- A view agrega `COUNT(*)` que retorna o número, sem expor as linhas.
- View precisa ser construída de modo que o `COUNT` execute como definer
  de view ou via SECURITY DEFINER function helper.

**Decisão final**: usar `SECURITY DEFINER` function `get_feed(p_limit, p_offset)`
que retorna `(video, like_count, viewer_liked)` sem expor `video_likes` direto.
Análogo ao padrão de `is_league_member` da feature 002.

---

### 6. Otimistic UI para curtir

**Decision**: Atualizar contagem e estado do botão imediatamente; reverter em
caso de erro.

```ts
async function toggleLike(videoId: string, currentlyLiked: boolean) {
  // 1. Update local state (otimista)
  setLiked(videoId, !currentlyLiked);
  setCount(videoId, prev => prev + (currentlyLiked ? -1 : +1));

  // 2. Persist
  try {
    if (currentlyLiked) {
      await supabase.from('video_likes').delete().eq('video_id', videoId);
    } else {
      await supabase.from('video_likes').insert({ video_id: videoId });
    }
  } catch (e) {
    // 3. Revert
    setLiked(videoId, currentlyLiked);
    setCount(videoId, prev => prev + (currentlyLiked ? +1 : -1));
    toast.error('Não foi possível curtir');
  }
}
```

---

### 7. Web Push API + VAPID (sem provider externo)

**Decision**: Usar Web Push Protocol nativo dos browsers. Sem FCM/OneSignal.

**Rationale**:
- **Custo zero**: nenhum provider, nenhum SDK externo.
- **Padrão aberto**: Chrome, Firefox, Edge, Safari 16.4+ suportam o mesmo
  protocolo. Não há lock-in.
- Cada browser tem seu push service (FCM para Chrome, Mozilla autopush para
  Firefox, Apple Push Service para Safari). O endpoint da subscription
  identifica qual usar — totalmente transparente.
- Suporta `tag` (deduplicação), `actions` (botões), `data` (payload custom).

**Limitações aceitas**:
- **iOS < 16.4**: sem suporte. Detectar e desabilitar toggle.
- **iOS instalado como PWA**: necessário "Adicionar à tela inicial" para
  receber push. Documentar na UX.
- **Desktop com browser fechado**: push só chega se o navegador estiver
  rodando em background (true em Windows/macOS por padrão).

---

### 8. VAPID keys: geradas uma vez, distribuídas como secrets

**Decision**: Gerar par de chaves VAPID na configuração inicial; armazenar
em Supabase Secrets.

**Geração** (one-time, antes do deploy):
```bash
npx web-push generate-vapid-keys
# Public Key: BJ...
# Private Key: K7...
```

**Distribuição**:
- `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT` (mailto:contato@evopadel.app) →
  secrets da Edge Function (`supabase secrets set`).
- `VAPID_PUBLIC_KEY` → variável pública do client
  (`VITE_VAPID_PUBLIC_KEY` no `.env`). Pública por definição (browser usa
  para validar o servidor de push).

**Documentar no quickstart**: gerar e configurar as chaves antes de testar.

---

### 9. Edge Function `send-push-notification`

**Decision**: Uma única Edge Function que aceita
`{ profile_ids: string[], title, body, url }` e envia para todas as
subscriptions dos perfis listados.

```ts
// supabase/functions/send-push-notification/index.ts
import webpush from "https://esm.sh/web-push@3.6.7";

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT")!,
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!
);

Deno.serve(async (req) => {
  const { profile_ids, title, body, url } = await req.json();

  // Guard: array vazio retorna no-op sem tocar o banco.
  if (!Array.isArray(profile_ids) || profile_ids.length === 0) {
    return new Response(JSON.stringify({ sent: 0, dead: 0 }));
  }

  // Busca subscriptions dos perfis (service_role bypassa RLS)
  const { data: subs } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('profile_id', profile_ids);

  const results = await Promise.allSettled(
    subs.map(sub => sendPush(sub, { title, body, url }))
  );

  // Remove subscriptions inválidas (410/404)
  const dead = results
    .map((r, i) => r.status === 'rejected' && [410, 404].includes(r.reason.statusCode) ? subs[i].id : null)
    .filter(Boolean);

  if (dead.length > 0) {
    await supabaseAdmin.from('push_subscriptions').delete().in('id', dead);
  }

  return new Response(JSON.stringify({ sent: results.length, dead: dead.length }));
});
```

**Rationale**:
- Função única simplifica deployment e debugging.
- Lógica de "para quem enviar" fica nos triggers que chamam a função, não na
  função em si.
- Cleanup de subscriptions mortas é parte do envio — sem job extra.

---

### 10. Triggers de eventos → Edge Function via `pg_net`

**Decision**: Triggers Postgres detectam os 3 eventos e chamam a Edge
Function via `pg_net.http_post` de forma assíncrona.

**Os 3 triggers**:

**(a) Partida registrada**: trigger `AFTER INSERT ON match_players` chama
para cada profile_id (exceto o criador). Detecta criador via
`(SELECT created_by FROM matches WHERE id = NEW.match_id)`.

```sql
CREATE FUNCTION notify_match_registered() RETURNS trigger AS $$
DECLARE
  v_creator uuid;
  v_delta int;
BEGIN
  SELECT created_by INTO v_creator FROM matches WHERE id = NEW.match_id;
  IF NEW.profile_id = v_creator THEN RETURN NEW; END IF;

  v_delta := NEW.points_delta;
  PERFORM net.http_post(
    url := current_setting('app.edge_function_url') || '/send-push-notification',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.edge_function_key')),
    body := jsonb_build_object(
      'profile_ids', ARRAY[NEW.profile_id],
      'title', 'Nova partida registrada',
      'body', CASE WHEN v_delta >= 0 THEN 'Você ganhou ' || v_delta || ' pontos!'
                   ELSE 'Você perdeu ' || abs(v_delta) || ' pontos.' END,
      'url', '/profile/history'
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**(b) Mudança de posição no ranking ≥ 3**: trigger `AFTER UPDATE OF points ON
profiles` calcula a posição antes e depois e dispara se `ABS(delta_pos) >= 3`.

A posição é computada via `RANK() OVER (ORDER BY points DESC, wins DESC, losses ASC)`
— função `get_rank_position(profile_id)` SECURITY DEFINER auxiliar.

**(c) Adicionado a uma liga**: trigger `AFTER INSERT ON league_players`,
exceto quando o adicionado é o próprio dono (caso do `create_league`).

```sql
CREATE FUNCTION notify_league_added() RETURNS trigger AS $$
DECLARE
  v_owner uuid;
  v_league_name text;
BEGIN
  SELECT owner_id, name INTO v_owner, v_league_name
    FROM leagues WHERE id = NEW.league_id;
  IF NEW.profile_id = v_owner THEN RETURN NEW; END IF;

  PERFORM net.http_post(
    url := current_setting('app.edge_function_url') || '/send-push-notification',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.edge_function_key')),
    body := jsonb_build_object(
      'profile_ids', ARRAY[NEW.profile_id],
      'title', 'Convite para liga',
      'body', 'Você foi adicionado à liga "' || v_league_name || '"',
      'url', '/leagues/' || NEW.league_id::text
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Configuração de runtime** (variáveis postgres):
```sql
ALTER DATABASE postgres SET app.edge_function_url = 'https://<ref>.supabase.co/functions/v1';
ALTER DATABASE postgres SET app.edge_function_key = '<service_role_key>';
```

> No ambiente local de testes, as variáveis apontam para o local Supabase.

---

### 11. Por que assíncrono via `pg_net` e não SYNC

`pg_net.http_post` enfileira a chamada HTTP e retorna imediatamente. Mesmo
que o Edge Function leve 3-5 segundos, o INSERT no banco não trava — o
usuário não vê latência da notificação.

**Trade-off**: se a Edge Function falhar (rede, deploy fora do ar), a
notificação se perde silenciosamente. Para o MVP é aceitável; pós-MVP
considerar `pg_net` com retry policy ou tabela de outbox.

---

### 12. Service Worker do client

**Decision**: registrar `/sw.js` no client com handler de `push` e
`notificationclick`.

```js
// public/sw.js
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      tag: data.tag ?? 'evopadel',
      data: { url: data.url ?? '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.openWindow(event.notification.data.url)
  );
});
```

**Registro no client** (uma vez, após permissão concedida):
```ts
const reg = await navigator.serviceWorker.register('/sw.js');
const sub = await reg.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: urlBase64ToUint8Array(VITE_VAPID_PUBLIC_KEY),
});

await supabase.from('push_subscriptions').insert({
  endpoint: sub.endpoint,
  p256dh: arrayBufferToBase64(sub.getKey('p256dh')),
  auth: arrayBufferToBase64(sub.getKey('auth')),
  user_agent: navigator.userAgent,
});
```

---

### 13. Casos de teste críticos desta feature

**14 testes de integração**:

1. **Upload**: MP4 ≤ 30MB persiste em `videos/{user_id}/{uuid}.mp4` e
   insere linha em `videos`.
2. **Upload**: arquivo > 30MB rejeitado pelo bucket.
3. **Upload**: AVI/FLV rejeitado (MIME).
4. **Feed**: query `get_feed(20, 0)` retorna 20 vídeos não-expirados
   ordenados por `created_at DESC`.
5. **Feed**: vídeo com `expires_at < now()` NÃO aparece no feed.
6. **Curtir**: INSERT em `video_likes` incrementa contagem na view; DELETE
   decrementa.
7. **Curtir**: tentar curtir 2× retorna erro UNIQUE.
8. **Curtir (privacidade)**: usuário B não consegue ler curtidas do usuário A
   via `SELECT * FROM video_likes WHERE profile_id = A.id` (RLS bloqueia).
9. **Excluir vídeo**: autor consegue excluir; arquivo no Storage some;
   linha em `videos` removida; CASCADE limpa `video_likes`.
10. **Excluir vídeo**: não-autor recebe erro de policy ao tentar DELETE.
11. **Retenção**: `cleanup_expired_videos()` apaga arquivos com
    `expires_at < now()` e mantém vídeos válidos.
12. **Push subscription**: INSERT em `push_subscriptions` registra sem erro;
    UPDATE não é permitido (apenas insert/delete).
13. **Push trigger (partida)**: INSERT em `match_players` dispara `pg_net`
    para Edge Function (verificar via tabela `net.http_request_queue`).
14. **Push trigger (liga)**: INSERT em `league_players` por outro user
    dispara push; INSERT pelo próprio dono via `create_league` NÃO dispara
    (autoadição não notifica).

---

### 14. Migrations: ordem e numeração

**Decision**: Continuar a numeração da feature 002 (`020+`).

**Sequência**:
```
supabase/migrations/
├── 020_create_videos.sql                 -- ENUM video_category + tabela videos
├── 021_create_video_likes.sql            -- tabela video_likes
├── 022_create_push_subscriptions.sql     -- tabela push_subscriptions
├── 023_feed_rls_policies.sql             -- RLS em videos, video_likes, push_subscriptions
├── 024_get_feed_rpc.sql                  -- get_feed() SECURITY DEFINER
├── 025_cleanup_expired_videos.sql        -- função + pg_cron schedule
├── 026_push_notification_triggers.sql    -- 3 triggers (match, ranking, league)
└── 027_storage_videos_bucket.sql         -- bucket videos + policies
```

**Edge Functions** (não são migrations):
```
supabase/functions/
└── send-push-notification/
    └── index.ts
```

---

### 15. Segurança das Edge Functions

**Decision**: A Edge Function `send-push-notification` aceita chamadas
apenas com o `service_role` key (header `Authorization: Bearer <key>`).
Nenhum client direto.

**Por quê**: a função tem permissão de ler/deletar `push_subscriptions` —
não pode ser pública.

**Implementação**: validar header no início da função:
```ts
const authHeader = req.headers.get('authorization');
if (authHeader !== `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`) {
  return new Response('Unauthorized', { status: 401 });
}
```

Apenas os triggers Postgres (via `pg_net` com header configurado) conseguem
chamar. Cliente JS no browser **não** invoca essa função diretamente.
