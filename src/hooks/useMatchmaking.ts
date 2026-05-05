import { useCallback, useEffect, useState } from 'react';
import type { MatchmakingSuggestion } from '../../specs/001-matchpoint-mvp/contracts/types';
import { useAuth } from '../contexts/AuthContext';
import { rankingService } from '../services/ranking.service';

export function useMatchmaking() {
  const { profile } = useAuth();
  const [suggestions, setSuggestions] = useState<MatchmakingSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!profile) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const nextSuggestions = await rankingService.getMatchmakingSuggestions(profile.points);
      setSuggestions(nextSuggestions);
    } catch {
      setError('Nao foi possivel carregar sugestoes.');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    suggestions,
    loading,
    error,
    refresh,
  };
}
