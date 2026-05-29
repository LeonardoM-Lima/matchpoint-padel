import type { PlayerCategory } from '../../specs/001-matchpoint-mvp/contracts/types';
import {
  IMAGE_UPLOAD_LIMITS,
  type UpdateProfilePayload,
} from '../../specs/002-perfil-e-ligas/contracts/types';
import { supabase } from '../lib/supabase';

const invalidPhotoMessage = 'Foto deve ser JPG, PNG ou WebP com ate 2MB';

export interface PublicProfile {
  id: string;
  name: string;
  avatarUrl: string | null;
  category: PlayerCategory | null;
  points: number;
  wins: number;
  losses: number;
  createdAt: string;
  updatedAt: string;
}

interface PublicProfileRow {
  id: string;
  name: string;
  avatar_url: string | null;
  category: PlayerCategory | null;
  points: number;
  wins: number;
  losses: number;
  created_at: string;
  updated_at: string;
}

function mapPublicProfile(row: PublicProfileRow): PublicProfile {
  return {
    id: row.id,
    name: row.name,
    avatarUrl: row.avatar_url,
    category: row.category,
    points: row.points,
    wins: row.wins,
    losses: row.losses,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validateImage(file: File) {
  if (
    file.size > IMAGE_UPLOAD_LIMITS.maxBytes ||
    !IMAGE_UPLOAD_LIMITS.allowedMimeTypes.includes(file.type as never)
  ) {
    throw new Error(invalidPhotoMessage);
  }
}

function imageExtension(file: File) {
  if (file.type === 'image/jpeg') return 'jpg';
  if (file.type === 'image/png') return 'png';
  return 'webp';
}

function uniqueImagePath(folderId: string, prefix: string, file: File) {
  return `${folderId}/${prefix}-${Date.now()}.${imageExtension(file)}`;
}

function normalizeProfilePayload(payload: UpdateProfilePayload) {
  const update: { name?: string; avatar_url?: string | null; category?: PlayerCategory | null } = {};

  if (payload.name !== undefined) {
    const name = payload.name.trim();
    if (name.length < 2 || name.length > 30) {
      throw new Error('Nickname deve ter entre 2 e 30 caracteres');
    }
    update.name = name;
  }

  if (payload.avatarUrl !== undefined) update.avatar_url = payload.avatarUrl;
  if (payload.category !== undefined) update.category = payload.category as PlayerCategory | null;

  return update;
}

export const profileService = {
  validateImage,

  async updateProfile(profileId: string, payload: UpdateProfilePayload) {
    const update = normalizeProfilePayload(payload);
    const { error } = await supabase.from('profiles').update(update).eq('id', profileId);
    if (error) throw error;
  },

  async uploadAvatar(userId: string, file: File) {
    validateImage(file);
    const path = uniqueImagePath(userId, 'avatar', file);
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { cacheControl: '3600', contentType: file.type });

    if (uploadError) throw uploadError;

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: path })
      .eq('user_id', userId);

    if (updateError) throw updateError;
    return path;
  },

  async getPublicProfile(profileId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id,name,avatar_url,category,points,wins,losses,created_at,updated_at')
      .eq('id', profileId)
      .single();

    if (error) throw error;
    return mapPublicProfile(data as PublicProfileRow);
  },
};
