import { useCallback, useEffect, useState } from 'react';
import type { EligibleLeague } from '../../specs/002-perfil-e-ligas/contracts/types';
import { leagueService } from '../services/league.service';

export function useEligibleLeagues(playerIds: string[]) {
  const [leagues, setLeagues] = useState<EligibleLeague[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (playerIds.length !== 4 || playerIds.some((id) => !id)) {
      setLeagues([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      setLeagues(await leagueService.getEligibleLeagues(playerIds));
    } catch {
      setLeagues([]);
    } finally {
      setLoading(false);
    }
  }, [playerIds]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { leagues, loading, refresh };
}
