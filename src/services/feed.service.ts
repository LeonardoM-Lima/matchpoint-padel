import { supabase } from '../lib/supabase';
import { getVideoDuration } from '../lib/videoDuration';

export type VideoCategory =
  | 'smash'
  | 'bandeja'
  | 'vibora'
  | 'saque'
  | 'tombo'
  | 'furada'
  | 'engracado'
  | 'outras';

export const VIDEO_CATEGORY_LABEL: Record<VideoCategory, string> = {
  smash: 'Smash',
  bandeja: 'Bandeja',
  vibora: 'Víbora',
  saque: 'Saque',
  tombo: 'Tombo',
  furada: 'Furada',
  engracado: 'Engraçado',
  outras: 'Outras',
};

export const VIDEO_CATEGORIES = Object.keys(VIDEO_CATEGORY_LABEL) as VideoCategory[];

export const VIDEO_UPLOAD_LIMITS = {
  maxBytes: 30 * 1024 * 1024,
  maxDurationSec: 30,
  allowedMimeTypes: ['video/mp4', 'video/quicktime', 'video/webm'],
} as const;

export interface FeedItem {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  title: string;
  category: VideoCategory;
  storagePath: string;
  createdAt: string;
  likeCount: number;
  viewerLiked: boolean;
}

interface FeedItemRow {
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

function videoExtension(file: File) {
  if (file.type === 'video/quicktime') return 'mov';
  if (file.type === 'video/webm') return 'webm';
  return 'mp4';
}

function mapFeedItem(row: FeedItemRow): FeedItem {
  return {
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
  };
}

export function getVideoPublicUrl(storagePath: string) {
  return supabase.storage.from('videos').getPublicUrl(storagePath).data.publicUrl;
}

export async function validateVideo(file: File) {
  if (file.size > VIDEO_UPLOAD_LIMITS.maxBytes) {
    throw new Error('Vídeo deve ter até 30MB');
  }

  if (!VIDEO_UPLOAD_LIMITS.allowedMimeTypes.includes(file.type as never)) {
    throw new Error('Formato deve ser MP4, MOV ou WebM');
  }

  const duration = await getVideoDuration(file);
  if (Number.isFinite(duration) && duration > VIDEO_UPLOAD_LIMITS.maxDurationSec) {
    throw new Error('Vídeo deve ter até 30 segundos');
  }
}

export async function publishVideo(params: {
  authorUserId: string;
  authorProfileId: string;
  file: File;
  title: string;
  category: VideoCategory;
}) {
  const title = params.title.trim();
  if (title.length < 3 || title.length > 80) {
    throw new Error('Título deve ter entre 3 e 80 caracteres');
  }

  await validateVideo(params.file);

  const videoId = crypto.randomUUID();
  const storagePath = `${params.authorUserId}/${videoId}.${videoExtension(params.file)}`;

  const { error: uploadError } = await supabase.storage
    .from('videos')
    .upload(storagePath, params.file, {
      contentType: params.file.type,
      upsert: false,
    });

  if (uploadError) {
    throw new Error('Não foi possível enviar o vídeo. Tente novamente.');
  }

  const { error: insertError } = await supabase.from('videos').insert({
    id: videoId,
    author_id: params.authorProfileId,
    title,
    category: params.category,
    storage_path: storagePath,
  });

  if (insertError) {
    await supabase.storage.from('videos').remove([storagePath]);
    throw new Error(insertError.message || 'Não foi possível enviar o vídeo. Tente novamente.');
  }

  return videoId;
}

export async function getFeed(limit = 20, offset = 0) {
  const { data, error } = await supabase.rpc('get_feed', {
    p_limit: limit,
    p_offset: offset,
  });

  if (error) throw error;
  return ((data ?? []) as FeedItemRow[]).map(mapFeedItem);
}

export async function likeVideo(videoId: string, profileId: string) {
  const { error } = await supabase.from('video_likes').insert({
    video_id: videoId,
    profile_id: profileId,
  });

  if (error) throw error;
}

export async function unlikeVideo(videoId: string) {
  const { error } = await supabase.from('video_likes').delete().eq('video_id', videoId);
  if (error) throw error;
}

export async function deleteVideo(videoId: string, storagePath: string) {
  const { error: storageError } = await supabase.storage.from('videos').remove([storagePath]);
  if (storageError) {
    throw new Error('Não foi possível excluir o vídeo. Tente novamente.');
  }

  const { error: dbError } = await supabase.from('videos').delete().eq('id', videoId);
  if (dbError) {
    throw new Error('Não foi possível excluir o vídeo. Tente novamente.');
  }
}
