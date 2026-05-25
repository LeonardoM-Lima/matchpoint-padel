import { useCallback, useEffect, useState } from 'react';
import type { LeagueDTO } from '../../specs/002-perfil-e-ligas/contracts/types';
import { leagueService } from '../services/league.service';

export function useLeagues() {
  const [leagues, setLeagues] = useState<LeagueDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setLeagues(await leagueService.getMyLeagues());
    } catch {
      setError('Nao foi possivel carregar suas ligas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { leagues, loading, error, refresh };
}
