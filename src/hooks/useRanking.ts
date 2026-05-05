import { useCallback, useEffect, useMemo, useState } from 'react';
import type { RankingEntry } from '../../specs/001-matchpoint-mvp/contracts/types';
import { useAuth } from '../contexts/AuthContext';
import { rankingService } from '../services/ranking.service';

export function useRanking() {
  const { profile } = useAuth();
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const nextRanking = await rankingService.getRanking();
      setRanking(nextRanking);
    } catch {
      setError('Nao foi possivel carregar o ranking.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const currentIndex = useMemo(
    () => ranking.findIndex((entry) => entry.id === profile?.id),
    [profile?.id, ranking],
  );

  const currentEntry = currentIndex >= 0 ? ranking[currentIndex] ?? null : null;
  const aboveEntry = currentIndex > 0 ? ranking[currentIndex - 1] ?? null : null;
  const belowEntry = currentIndex >= 0 ? ranking[currentIndex + 1] ?? null : null;

  return {
    ranking,
    currentEntry,
    aboveEntry,
    belowEntry,
    loading,
    error,
    refresh,
  };
}
