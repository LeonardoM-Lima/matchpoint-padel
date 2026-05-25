import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { profileService } from '../services/profile.service';
import type { UpdateProfilePayload } from '../../specs/002-perfil-e-ligas/contracts/types';

export function useProfile() {
  const { profile, user, loading, refreshProfile } = useAuth();

  const refresh = useCallback(async () => {
    await refreshProfile();
  }, [refreshProfile]);

  const updateProfile = useCallback(
    async (payload: UpdateProfilePayload) => {
      if (!profile) throw new Error('Nao foi possivel carregar seu perfil.');
      await profileService.updateProfile(profile.id, payload);
      await refreshProfile();
    },
    [profile, refreshProfile],
  );

  const uploadAvatar = useCallback(
    async (file: File) => {
      if (!user) throw new Error('Usuario autenticado obrigatorio.');
      const path = await profileService.uploadAvatar(user.id, file);
      await refreshProfile();
      return path;
    },
    [refreshProfile, user],
  );

  return {
    profile,
    loading,
    refresh,
    updateProfile,
    uploadAvatar,
  };
}
