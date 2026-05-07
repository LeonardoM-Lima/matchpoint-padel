import { useEffect, useState } from 'react';
import { matchService, type MatchHistoryEntry } from '../services/match.service';
import { useProfile } from './useProfile';

export function useMatchHistory() {
  const { profile } = useProfile();
  const [matches, setMatches] = useState<MatchHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;

    setLoading(true);
    setError(null);

    matchService
      .getMatchHistory(profile.id)
      .then(setMatches)
      .catch(() => setError('Não foi possível carregar o histórico.'))
      .finally(() => setLoading(false));
  }, [profile]);

  return { loading, error, matches };
}
