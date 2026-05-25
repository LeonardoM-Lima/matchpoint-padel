// contracts/types.ts (003-feed-e-push)
// DTOs e payloads para Feed de Jogadas + Notificações Push.

// ─── Feed ────────────────────────────────────────────────────────────────────

/** Categorias de jogadas (FR-004). Valores ASCII no banco; mapeamento
 *  humanizado feito no client. */
export type VideoCategory =
  | 'smash' | 'bandeja' | 'vibora' | 'saque'
  | 'tombo' | 'furada' | 'engracado' | 'outras';

/** Mapeamento ENUM → label humanizado. */
export const VIDEO_CATEGORY_LABEL: Record<VideoCategory, string> = {
  smash:    'Smash',
  bandeja:  'Bandeja',
  vibora:   'Víbora',
  saque:    'Saque',
  tombo:    'Tombo',
  furada:   'Furada',
  engracado:'Engraçado',
  outras:   'Outras',
};

/** Limites de upload (FR-002). */
export const VIDEO_UPLOAD_LIMITS = {
  maxBytes: 30 * 1024 * 1024,    // 30 MB
  maxDurationSec: 30,            // validação client-side (FR-003)
  allowedMimeTypes: ['video/mp4', 'video/quicktime', 'video/webm'] as const,
} as const;

export type AllowedVideoMimeType = (typeof VIDEO_UPLOAD_LIMITS.allowedMimeTypes)[number];

/** Vídeo conforme retornado pelo banco (sem joins). */
export interface VideoDTO {
  id: string;
  authorId: string;
  title: string;
  category: VideoCategory;
  storagePath: string;
  createdAt: string;
  expiresAt: string;
}

/** Item exibido no feed (retorno de `get_feed`).
 *  Nota: `author_avatar` no SQL é `text` nullable. O adapter em rpc.ts mapeia
 *  `null` → `undefined` para que o consumidor TS use `?.` sem verificar null
 *  explicitamente. */
export interface FeedItem {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;   // path no bucket avatars (resolver via Storage URL). undefined = sem foto, usar fallback de iniciais.
  title: string;
  category: VideoCategory;
  storagePath: string;     // path no bucket videos (resolver via Storage URL)
  createdAt: string;
  likeCount: number;
  viewerLiked: boolean;
}

/** Payload para publicar um novo vídeo. */
export interface PublishVideoPayload {
  title: string;
  category: VideoCategory;
  storagePath: string;     // já enviado ao Storage antes do INSERT
}

// ─── Push Notifications ─────────────────────────────────────────────────────

/** Subscription Web Push armazenada no banco. */
export interface PushSubscriptionDTO {
  id: string;
  profileId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
  createdAt: string;
}

/** Payload para registrar uma nova subscription.
 *  Nota: o adapter (`toInsertPushSubscriptionRow` em rpc.ts) PRECISA
 *  preencher `profile_id` no INSERT explicitamente, lendo do contexto da
 *  sessão. A RLS `WITH CHECK` apenas valida que `profile_id` corresponde
 *  ao usuário autenticado — não auto-preenche. O mesmo vale para
 *  `PublishVideoPayload` (author_id) e `video_likes` (profile_id). */
export interface RegisterPushSubscriptionPayload {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}

/** Payload da Edge Function `send-push-notification`. */
export interface SendPushPayload {
  profileIds: string[];
  title: string;
  body: string;
  url: string;
  tag?: string;
}

/** Resposta da Edge Function. */
export interface SendPushResult {
  sent: number;
  dead: number;
}

/** Status do suporte e ativação de push no browser do usuário. */
export interface PushStatus {
  supported: boolean;        // browser tem Service Worker + Push API
  permission: NotificationPermission;  // 'default' | 'granted' | 'denied'
  active: boolean;           // user tem ao menos 1 subscription persistida
}
