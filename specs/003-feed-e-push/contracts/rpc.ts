// contracts/rpc.ts (003-feed-e-push)
// Adapters camelCase ↔ snake_case para RPCs e tabelas.

import type {
  PublishVideoPayload,
  RegisterPushSubscriptionPayload,
  SendPushPayload,
  VideoCategory,
} from './types';

// ─── get_feed ────────────────────────────────────────────────────────────────

export interface GetFeedRPCParams {
  p_limit?: number;
  p_offset?: number;
}

/** Shape bruto retornado pela RPC (antes do mapeamento para FeedItem). */
export interface FeedItemRow {
  id: string;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  title: string;
  category: VideoCategory;
  storage_path: string;
  created_at: string;
  like_count: number;
  viewer_liked: boolean;
}

// ─── Insert video (regular INSERT, não RPC) ─────────────────────────────────

/** Shape inserido na tabela `videos`. `author_id` PRECISA ser enviado
 *  explicitamente pelo client (RLS WITH CHECK apenas valida, não auto-preenche). */
export interface InsertVideoRow {
  author_id: string;
  title: string;
  category: VideoCategory;
  storage_path: string;
}

export function toInsertVideoRow(
  payload: PublishVideoPayload,
  authorProfileId: string,
): InsertVideoRow {
  return {
    author_id: authorProfileId,
    title: payload.title,
    category: payload.category,
    storage_path: payload.storagePath,
  };
}

// ─── Push subscriptions (regular INSERT) ────────────────────────────────────

/** Shape inserido em `push_subscriptions`. `profile_id` PRECISA ser
 *  enviado explicitamente pelo client. */
export interface InsertPushSubscriptionRow {
  profile_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent?: string;
}

export function toInsertPushSubscriptionRow(
  payload: RegisterPushSubscriptionPayload,
  profileId: string,
): InsertPushSubscriptionRow {
  const row: InsertPushSubscriptionRow = {
    profile_id: profileId,
    endpoint: payload.endpoint,
    p256dh: payload.p256dh,
    auth: payload.auth,
  };
  if (payload.userAgent) row.user_agent = payload.userAgent;
  return row;
}

// ─── Edge Function: send-push-notification ──────────────────────────────────

/** Payload da Edge Function (snake_case já no formato consumido pelo Deno). */
export interface SendPushRPCBody {
  profile_ids: string[];
  title: string;
  body: string;
  url: string;
  tag?: string;
}

export function toSendPushBody(payload: SendPushPayload): SendPushRPCBody {
  const body: SendPushRPCBody = {
    profile_ids: payload.profileIds,
    title: payload.title,
    body: payload.body,
    url: payload.url,
  };
  if (payload.tag) body.tag = payload.tag;
  return body;
}
