import { useEffect, useRef } from 'react';
import { usePushSubscription } from '../hooks/usePushSubscription';
import { Icon } from './Icon';

interface PushToggleProps {
  profileId?: string;
  autoEnable?: boolean;
}

export function PushToggle({ profileId, autoEnable = false }: PushToggleProps) {
  const { status, loading, saving, error, enable, disable } = usePushSubscription(profileId);
  const disabled = loading || saving || !status.supported;
  const autoEnableAttempted = useRef(false);

  useEffect(() => {
    if (!autoEnable || autoEnableAttempted.current || loading || saving) return;
    if (!profileId || !status.supported || status.active || status.permission !== 'default') return;

    autoEnableAttempted.current = true;
    void enable({ silent: true });
  }, [autoEnable, enable, loading, profileId, saving, status.active, status.permission, status.supported]);

  return (
    <section className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-300/15 text-emerald-300 ring-1 ring-emerald-300/20">
          <Icon name="bell" size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-extrabold text-slate-50">Notificacoes push</h2>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Ativas por padrão para avisos de partidas, ranking e ligas.
              </p>
            </div>

            <button
              type="button"
              className={[
                'relative h-8 w-14 shrink-0 rounded-full transition disabled:opacity-50',
                status.active ? 'bg-emerald-400' : 'bg-slate-700',
              ].join(' ')}
              disabled={disabled}
              title={status.supported ? undefined : status.reason ?? 'Seu navegador não suporta notificações push'}
              onClick={() => {
                if (status.active) {
                  void disable();
                } else {
                  void enable();
                }
              }}
              aria-pressed={status.active}
            >
              <span
                className={[
                  'absolute top-1 h-6 w-6 rounded-full bg-slate-50 transition',
                  status.active ? 'left-7' : 'left-1',
                ].join(' ')}
              />
            </button>
          </div>

          {!status.supported ? (
            <p className="mt-3 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-300">
              Seu navegador não suporta notificações push.
            </p>
          ) : null}

          {status.permission === 'denied' ? (
            <p className="mt-3 rounded-xl border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-100">
              Permissão negada nas configurações do navegador. Habilite para receber notificações.
            </p>
          ) : null}

          {error ? (
            <p className="mt-3 rounded-xl border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-100">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
