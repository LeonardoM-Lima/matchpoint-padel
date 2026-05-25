import { useCallback, useEffect, useState } from 'react';
import {
  getPushStatus,
  subscribePush,
  unsubscribePush,
  type PushStatus,
} from '../services/push.service';

const defaultStatus: PushStatus = {
  supported: false,
  permission: 'default',
  active: false,
};

export function usePushSubscription(profileId?: string) {
  const [status, setStatus] = useState<PushStatus>(defaultStatus);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!profileId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setStatus(await getPushStatus(profileId));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Não foi possível ler as notificações.');
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  const enable = useCallback(async () => {
    if (!profileId) return;
    setSaving(true);
    setError(null);

    try {
      await subscribePush(profileId);
      await refresh();
    } catch (nextError) {
      const message = nextError instanceof Error
        ? nextError.message
        : 'Não foi possível ativar notificações push.';
      setError(message);
      await refresh();
    } finally {
      setSaving(false);
    }
  }, [profileId, refresh]);

  const disable = useCallback(async () => {
    if (!profileId) return;
    setSaving(true);
    setError(null);

    try {
      await unsubscribePush(profileId);
      await refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Não foi possível desativar notificações push.');
    } finally {
      setSaving(false);
    }
  }, [profileId, refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    status,
    loading,
    saving,
    error,
    enable,
    disable,
  };
}
