import { useCallback, useEffect, useState } from 'react';
import type { MatchmakingSuggestion } from '../../specs/001-matchpoint-mvp/contracts/types';
import { useAuth } from '../contexts/AuthContext';
import {
  matchmakingService,
  type MatchmakingAvailability,
} from '../services/matchmaking.service';
import { rankingService } from '../services/ranking.service';

export function useMatchmaking() {
  const { profile } = useAuth();
  const [suggestions, setSuggestions] = useState<MatchmakingSuggestion[]>([]);
  const [availability, setAvailability] = useState<MatchmakingAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!profile) {
      setSuggestions([]);
      setAvailability(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [nextSuggestions, nextAvailability] = await Promise.all([
        rankingService.getMatchmakingSuggestions(profile.points),
        matchmakingService.getMyAvailability(profile.id),
      ]);
      setSuggestions(nextSuggestions);
      setAvailability(nextAvailability);
    } catch {
      setError('Nao foi possivel carregar sugestoes.');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  const activateAvailability = useCallback(
    async (whatsappNumber: string) => {
      if (!profile) throw new Error('Nao foi possivel carregar seu perfil.');

      setSavingAvailability(true);
      setError(null);

      try {
        const nextAvailability = await matchmakingService.activate(profile.id, whatsappNumber);
        const nextSuggestions = await rankingService.getMatchmakingSuggestions(profile.points);
        setAvailability(nextAvailability);
        setSuggestions(nextSuggestions);
      } finally {
        setSavingAvailability(false);
      }
    },
    [profile],
  );

  const deactivateAvailability = useCallback(async () => {
    if (!profile) return;

    setSavingAvailability(true);
    setError(null);

    try {
      await matchmakingService.deactivate(profile.id);
      const nextSuggestions = await rankingService.getMatchmakingSuggestions(profile.points);
      setAvailability(null);
      setSuggestions(nextSuggestions);
    } finally {
      setSavingAvailability(false);
    }
  }, [profile]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    suggestions,
    availability,
    savingAvailability,
    loading,
    error,
    refresh,
    activateAvailability,
    deactivateAvailability,
  };
}
