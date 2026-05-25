import { useCallback, useEffect, useState } from 'react';
import type { LeagueDetailDTO } from '../../specs/002-perfil-e-ligas/contracts/types';
import { leagueService } from '../services/league.service';

export function useLeague(leagueId?: string) {
  const [detail, setDetail] = useState<LeagueDetailDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!leagueId) {
      setDetail(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setDetail(await leagueService.getLeague(leagueId));
    } catch {
      setDetail(null);
      setError('Voce nao faz parte desta liga');
    } finally {
      setLoading(false);
    }
  }, [leagueId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { detail, loading, error, refresh };
}
