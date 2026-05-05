import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

export function useProfile() {
  const { profile, loading, refreshProfile } = useAuth();

  const refresh = useCallback(async () => {
    await refreshProfile();
  }, [refreshProfile]);

  return {
    profile,
    loading,
    refresh,
  };
}
