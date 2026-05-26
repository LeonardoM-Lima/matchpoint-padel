# Implementation Plan: Feed de Jogadas e Notificações Push

**Branch**: `003-feed-e-push` | **Date**: 2026-05-22 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/003-feed-e-push/spec.md`

## Summary

Extensão do EvoPadel com dois eixos de engajamento:

1. **Feed de Jogadas**: vídeos curtos (até 30s/30MB) categorizados (Smash,
   Bandeja, Víbora, Saque, Tombo, Furada, Engraçado, Outras), com curtidas
   privadas (só contagem agregada). Retenção automática de 60 dias via job
   diário. Vídeos hospedados no Supabase Storage no bucket `videos`.

2. **Notificações Push**: Web Push API + VAPID (sem provider externo), com
   3 eventos disparados via triggers no Postgres → `pg_net.http_post` →
   Supabase Edge Function `send-push-notification`. Toggle global único no
   perfil; preferências granulares ficam fora do escopo.

A escolha de Edge Function (não servidor Node separado) preserva o Princípio
I — Simplicidade do projeto. Triggers Postgres chamam a função
assincronamente via `pg_net`, sem latência no fluxo principal.

## Data Access Patterns

### Mutation: Upload de vídeo (`src/services/feed.service.ts`)

```ts
async function publishVideo(
  authorUserId: string,       // user_id do auth (para o path do Storage)
  authorProfileId: string,    // profile.id (para o INSERT)
  file: File,
  title: string,
  category: VideoCategory,
) {
  // 1. Validar client-side (FR-002, FR-003)
  if (file.size > VIDEO_UPLOAD_LIMITS.maxBytes) throw new Error('Vídeo deve ter até 30MB');
  if (!VIDEO_UPLOAD_LIMITS.allowedMimeTypes.includes(file.type as never))
    throw new Error('Formato deve ser MP4, MOV ou WebM');
  const duration = await getVideoDuration(file);
  if (duration > VIDEO_UPLOAD_LIMITS.maxDurationSec)
    throw new Error('Vídeo deve ter até 30 segundos');

  // 2. Upload no Storage (path usa user_id do auth, casa com Storage policy)
  const videoId = crypto.randomUUID();
  const ext = mimeToExt(file.type);
  const path = `${authorUserId}/${videoId}.${ext}`;
  const { error: upErr } = await supabase.storage.from('videos').upload(path, file, {
    contentType: file.type,
  });
  if (upErr) throw upErr;

  // 3. INSERT em videos. author_id é o profile.id (não o user_id).
  //    RLS WITH CHECK valida que author_id === current_profile.id.
  const { error: dbErr } = await supabase.from('videos').insert({
    id: videoId,
    author_id: authorProfileId,
    title: title.trim(),
    category,
    storage_path: path,
  });
  if (dbErr) {
    // rollback do Storage para evitar órfão
    await supabase.storage.from('videos').remove([path]);
    throw dbErr;
  }

  return videoId;
}
```

### Query: Feed paginado

```ts
async function getFeed(limit = 20, offset = 0): Promise<FeedItem[]> {
  const { data } = await supabase.rpc('get_feed', { p_limit: limit, p_offset: offset });
  return (data as FeedItemRow[]).map(row => ({
    id: row.id,
    authorId: row.author_id,
    authorName: row.author_name,
    authorAvatar: row.author_avatar ?? undefined,
    title: row.title,
    category: row.category,
    storagePath: row.storage_path,
    createdAt: row.created_at,
    likeCount: row.like_count,
    viewerLiked: row.viewer_liked,
  }));
}
```

### Mutation: Toggle de curtida (otimistic UI)

```ts
async function toggleLike(videoId: string, currentlyLiked: boolean) {
  if (currentlyLiked) {
    return supabase.from('video_likes').delete().eq('video_id', videoId);
    // RLS garante que o DELETE só afeta a linha do próprio user
  }
  return supabase.from('video_likes').insert({ video_id: videoId });
  // profile_id preenchido pelo RLS WITH CHECK
}
```

### Subscription Web Push (client)

```ts
async function subscribePush(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Navegador sem suporte a Push');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Permissão negada');
  }

  const reg = await navigator.serviceWorker.register('/sw.js');
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY),
  });

  await supabase.from('push_subscriptions').insert({
    profile_id: currentProfileId,  // do AuthContext
    endpoint: sub.endpoint,
    p256dh: arrayBufferToBase64(sub.getKey('p256dh')!),
    auth: arrayBufferToBase64(sub.getKey('auth')!),
    user_agent: navigator.userAgent,
  });
}
```

### Edge Function: envio de push

```ts
// supabase/functions/send-push-notification/index.ts
import webpush from "https://esm.sh/web-push@3.6.7";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT")!,
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  // Auth: aceita apenas service_role
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { profile_ids, title, body, url, tag } = await req.json();

  // Guard: profile_ids vazio → no-op (evita 'IN ()' inválido)
  if (!Array.isArray(profile_ids) || profile_ids.length === 0) {
    return new Response(JSON.stringify({ sent: 0, dead: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("profile_id", profile_ids);

  const dead: string[] = [];
  const results = await Promise.allSettled(
    (subs ?? []).map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify({ title, body, url, tag }),
        );
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          dead.push(sub.id);
        }
        throw err;
      }
    }),
  );

  if (dead.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", dead);
  }

  return new Response(JSON.stringify({ sent: results.length, dead: dead.length }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

## Technical Context

**Language/Version**: TypeScript strict, React 18, Node 20+ (dev), Deno
1.40+ (Edge Functions runtime).
**Primary Dependencies**: stack do MVP + `web-push@3.6.7` (apenas no Edge
Function via ESM). Nenhuma dependência nova no client.
**Storage**: Supabase Storage (bucket `videos` público para leitura, 30MB
limit, MP4/MOV/WebM). PostgreSQL para metadados, curtidas e subscriptions.
**Testing**: Vitest + Testing Library; Supabase local com `supabase start`.
Edge Functions testadas localmente via `supabase functions serve`.
**Target Platform**: Web mobile-first (≤ 390 px); player de vídeo HTML5
nativo. Push em browsers modernos (Chrome/Edge/Firefox em qualquer
plataforma; Safari iOS ≥ 16.4 com PWA instalado).
**Project Type**: web-app (BaaS + Edge Functions — sem servidor Node).
**Performance Goals**:
  - Upload de vídeo ≤ 15 s em 4G (SC-001).
  - Feed inicial ≤ 2 s (SC-002).
  - Push delivery ≤ 10 s (SC-003).
  - Job de retenção ≤ 30 s para 1000 vídeos (SC-004).
**Constraints**:
  - Sem transcodificação no MVP — aceita compatibilidade nativa do browser.
  - Sem provider externo de push.
  - Sem servidor Node — toda lógica no banco + Edge Functions.
  - RLS em todas as tabelas; queries de feed via SECURITY DEFINER.
**Scale/Scope**: incremento do MVP — 100–1000 vídeos ativos, 50–500
subscriptions, ~1 push/usuário/dia em média.

## Constitution Check

| Princípio | Status | Evidência |
|-----------|--------|-----------|
| I. Simplicidade | ✅ PASS | Sem provider externo de push, sem servidor Node |
| II. Spec como Fonte da Verdade | ✅ PASS | FRs cobrem todos os fluxos, data-model alinhado |
| III. Mobile-First | ✅ PASS | Feed com scroll vertical e player nativo; toggle de push no perfil |
| IV. Fluxo Principal Protegido | ✅ PASS | Feed e push são features paralelas ao registro de partida |
| V. Segurança Básica | ✅ PASS | RLS em todas as tabelas; curtidas privadas; Edge Function autenticada |
| VI. Testes de Regras Críticas | ✅ PASS | 14 testes cobrindo upload, feed, curtidas privadas, retenção, push triggers |
| VII. Integridade de Dados | ✅ PASS | UNIQUE (video_id, profile_id) em likes; FK CASCADE; cron limpa órfãos |

**Sem violações → Complexity Tracking fica vazio.**

## Project Structure

### Documentation (esta feature)

```text
specs/003-feed-e-push/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── types.ts
│   └── rpc.ts
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (incremento sobre 001 + 002)

```text
src/
├── services/
│   ├── feed.service.ts             # NOVO: publishVideo, getFeed, deleteVideo, toggleLike
│   └── push.service.ts             # NOVO: subscribe, unsubscribe, getStatus
├── hooks/
│   ├── useFeed.ts                  # NOVO: paginação + cache
│   ├── useVideoLike.ts             # NOVO: optimistic toggle
│   └── usePushSubscription.ts      # NOVO: estado de subscription do user
├── screens/
│   ├── FeedScreen.tsx              # NOVO: lista vertical de vídeos
│   ├── PublishVideoScreen.tsx      # NOVO: form de upload
│   └── ProfileScreen.tsx           # ESTENDE: toggle "Notificações push"
├── components/
│   ├── VideoCard.tsx               # NOVO: player + autor + likes + menu
│   ├── VideoUpload.tsx             # NOVO: input file + preview + validação
│   ├── LikeButton.tsx              # NOVO: ícone com contagem
│   ├── CategoryPicker.tsx          # NOVO: dropdown de 8 categorias
│   └── PushToggle.tsx              # NOVO: switch para perfil
├── lib/
│   ├── pushHelpers.ts              # NOVO: urlBase64ToUint8Array, base64 helpers
│   └── videoDuration.ts            # NOVO: getVideoDuration(file)
└── router/
    └── index.tsx                   # ESTENDE: rotas /feed, /feed/publish

public/
└── sw.js                            # NOVO: Service Worker para push

supabase/
├── migrations/
│   ├── 020_extensions_and_settings.sql       # pg_net + pg_cron
│   ├── 021_create_videos.sql
│   ├── 022_create_video_likes.sql
│   ├── 023_create_push_subscriptions.sql
│   ├── 024_feed_rls_policies.sql
│   ├── 025_feed_rpcs.sql                      # get_feed + get_my_videos
│   ├── 026_push_notification_helpers.sql      # enqueue_push_notification
│   ├── 027_register_match_v3.sql              # DROP v2 + push interno
│   ├── 028_league_push_trigger.sql            # único trigger restante
│   ├── 029_cleanup_expired_videos.sql         # cron + batch
│   └── 030_storage_videos_bucket.sql
└── functions/
    ├── send-push-notification/
    │   └── index.ts
    └── cleanup-video/
        └── index.ts                            # delete em lote

tests/
└── integration/
    ├── feed.test.ts                 # NOVO: upload, get_feed, get_my_videos, delete
    ├── video-likes.test.ts          # NOVO: toggle, privacidade RLS
    ├── push-subscriptions.test.ts   # NOVO: insert, delete, unique endpoint
    └── push-events.test.ts          # NOVO: register_match v3 + league trigger
                                     #        disparam pg_net.http_post correto
```

**Structure Decision**: Mantém a separação `services → hooks → screens` das
features anteriores. Adiciona pasta `lib/` para helpers de browser (já
existia `lib/supabase.ts`). Service Worker em `public/` para ficar
acessível como `/sw.js` (não passa pelo Vite). Edge Function em
`supabase/functions/` por convenção do Supabase CLI.

## Complexity Tracking

> **Sem violações da constituição — seção vazia.**
