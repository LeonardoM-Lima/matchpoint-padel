import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import { Icon } from '../components/Icon';
import { MatchmakingCard } from '../components/MatchmakingCard';
import { ScreenSkeleton } from '../components/ScreenSkeleton';
import { useMatchmaking } from '../hooks/useMatchmaking';
import { useProfile } from '../hooks/useProfile';

export function MatchmakingScreen() {
  const { profile } = useProfile();
  const {
    suggestions,
    availability,
    savingAvailability,
    loading,
    error,
    refresh,
    activateAvailability,
    deactivateAvailability,
  } = useMatchmaking();
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [showAvailabilityForm, setShowAvailabilityForm] = useState(false);
  const isAvailable = Boolean(availability?.isActive);

  useEffect(() => {
    if (availability?.whatsappNumber) {
      setWhatsappNumber(availability.whatsappNumber);
    }
  }, [availability?.whatsappNumber]);

  async function handleAvailabilitySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAvailabilityError(null);

    try {
      await activateAvailability(whatsappNumber);
      setShowAvailabilityForm(false);
    } catch (nextError) {
      setAvailabilityError(
        nextError instanceof Error
          ? nextError.message
          : 'Nao foi possivel ativar sua disponibilidade.',
      );
    }
  }

  async function handleDeactivateAvailability() {
    setAvailabilityError(null);

    try {
      await deactivateAvailability();
      setShowAvailabilityForm(false);
    } catch (nextError) {
      setAvailabilityError(
        nextError instanceof Error ? nextError.message : 'Nao foi possivel sair da lista.',
      );
    }
  }

  const availableUntil = availability?.availableUntil
    ? new Intl.DateTimeFormat('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(availability.availableUntil))
    : null;

  return (
    <main className="min-h-screen px-4 pb-32 pt-6 text-slate-50">
      <section className="mx-auto grid max-w-md gap-5 animate-fade-in">
        <header className="grid gap-3">
          <Link
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-300 hover:text-emerald-200"
            to="/"
          >
            <Icon name="arrowLeft" size={16} />
            Voltar
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-500 shadow-soft">
              <Icon name="users" size={24} strokeWidth={2.2} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">
                EvoPadel
              </p>
              <h1 className="font-display text-3xl font-extrabold text-slate-50">Matchmaking</h1>
            </div>
          </div>
          {profile ? (
            <p className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-800/80 bg-slate-900/50 px-4 py-3 text-sm text-slate-300">
              <Icon name="sparkles" size={16} className="text-emerald-300" />
              Jogadores disponiveis de todas as categorias, por categoria e ranking.
            </p>
          ) : null}
        </header>

        {loading ? <ScreenSkeleton rows={4} /> : null}

        {error ? (
          <ErrorBanner
            message={error}
            actionLabel="Tentar novamente"
            onAction={() => {
              void refresh();
            }}
          />
        ) : null}

        {!loading && profile ? (
          <section className="grid gap-4 rounded-2xl border border-emerald-300/20 bg-slate-900/60 p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-300/25">
                <Icon name={isAvailable ? 'checkCircle' : 'smartphone'} size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-extrabold text-slate-50">
                  {isAvailable ? 'Voce esta disponivel' : 'Estou disponivel para jogar'}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  {isAvailable && availableUntil
                    ? `Seu WhatsApp aparece ate ${availableUntil}.`
                    : 'Entre na lista apenas quando estiver procurando jogo. Seu WhatsApp fica visivel so nesse periodo.'}
                </p>
              </div>
            </div>

            {!showAvailabilityForm ? (
              isAvailable ? (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 text-sm font-bold text-slate-200 transition hover:bg-slate-800/60 disabled:opacity-60"
                    type="button"
                    disabled={savingAvailability}
                    onClick={() => {
                      void handleDeactivateAvailability();
                    }}
                  >
                    <Icon name="x" size={16} />
                    Sair da lista
                  </button>
                  <button
                    className="btn-primary inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl px-4 text-sm disabled:opacity-60"
                    type="button"
                    disabled={savingAvailability}
                    onClick={() => {
                      if (!availability?.whatsappNumber) return;
                      void activateAvailability(availability.whatsappNumber);
                    }}
                  >
                    <Icon name="refresh" size={16} />
                    {savingAvailability ? 'Salvando...' : 'Renovar 8h'}
                  </button>
                </div>
              ) : (
                <button
                  className="btn-primary inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl px-4 text-sm disabled:opacity-60"
                  type="button"
                  disabled={savingAvailability}
                  onClick={() => {
                    setAvailabilityError(null);
                    setShowAvailabilityForm(true);
                  }}
                >
                  <Icon name="check" size={16} />
                  Estou disponivel
                </button>
              )
            ) : (
              <form className="grid gap-3" onSubmit={handleAvailabilitySubmit}>
                <label className="grid gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-emerald-300">
                    WhatsApp com DDD
                  </span>
                  <input
                    className="min-h-[48px] rounded-xl border border-slate-700 bg-slate-950 px-3 text-slate-50 outline-none transition placeholder:text-slate-600 focus:border-emerald-300 disabled:opacity-60"
                    inputMode="tel"
                    placeholder="(11) 99999-9999"
                    value={whatsappNumber}
                    disabled={savingAvailability}
                    onChange={(event) => setWhatsappNumber(event.target.value)}
                  />
                </label>

                {availabilityError ? <ErrorBanner message={availabilityError} /> : null}

                <div className="grid grid-cols-2 gap-3">
                  <button
                    className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 text-sm font-bold text-slate-200 transition hover:bg-slate-800/60 disabled:opacity-60"
                    type="button"
                    disabled={savingAvailability}
                    onClick={() => {
                      setAvailabilityError(null);
                      setShowAvailabilityForm(false);
                    }}
                  >
                    <Icon name="x" size={16} />
                    Cancelar
                  </button>
                  <button
                    className="btn-primary inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl px-4 text-sm disabled:opacity-60"
                    type="submit"
                    disabled={savingAvailability}
                  >
                    <Icon name="check" size={16} />
                    {savingAvailability ? 'Salvando...' : 'Confirmar'}
                  </button>
                </div>
              </form>
            )}
          </section>
        ) : null}

        {!loading && !error && suggestions.length === 0 ? (
          <EmptyState
            icon="users"
            title="Ninguem disponivel agora"
            description="Jogadores aparecem aqui quando ativarem disponibilidade para jogo."
          />
        ) : null}

        {!loading && !error && suggestions.length > 0 ? (
          <div className="grid gap-3">
            {suggestions.map((suggestion) => (
              <MatchmakingCard
                key={suggestion.id}
                suggestion={suggestion}
                currentUserPoints={profile?.points ?? 0}
              />
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
