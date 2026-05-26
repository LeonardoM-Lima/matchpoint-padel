import { Link } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import { Icon } from '../components/Icon';
import { LeagueCard } from '../components/LeagueCard';
import { ScreenSkeleton } from '../components/ScreenSkeleton';
import { useLeagues } from '../hooks/useLeagues';

export function LeaguesScreen() {
  const { leagues, loading, error, refresh } = useLeagues();

  return (
    <main className="min-h-screen px-4 pb-32 pt-6 text-slate-50">
      <section className="mx-auto grid max-w-md gap-5 animate-fade-in">
        <header className="grid gap-3">
          <Link className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-300" to="/">
            <Icon name="arrowLeft" size={16} />
            Voltar
          </Link>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-emerald-500 shadow-soft">
                <Icon name="trophy" size={24} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">EvoPadel</p>
                <h1 className="font-display text-3xl font-extrabold text-slate-50">Minhas ligas</h1>
              </div>
            </div>
          </div>
        </header>

        <Link className="btn-primary inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-4" to="/leagues/new">
          <Icon name="plus" size={18} />
          Criar nova liga
        </Link>

        {loading ? <ScreenSkeleton rows={4} /> : null}

        {error ? (
          <ErrorBanner message={error} actionLabel="Tentar novamente" onAction={() => void refresh()} />
        ) : null}

        {!loading && !error && leagues.length === 0 ? (
          <EmptyState
            icon="trophy"
            title="Nenhuma liga ainda"
            description="Crie uma liga privada para acompanhar um ranking separado do seu grupo."
          />
        ) : null}

        {!loading && !error && leagues.length > 0 ? (
          <div className="grid gap-3">
            {leagues.map((league) => (
              <LeagueCard key={league.id} league={league} />
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
