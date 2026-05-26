import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ScreenSkeleton } from './ScreenSkeleton';
import { useAuth } from '../contexts/AuthContext';

export function ProtectedRoute() {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100">
        <section className="mx-auto grid max-w-md gap-6">
          <header className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-300">
              PadelUP
            </p>
            <h1 className="text-3xl font-bold">Carregando</h1>
          </header>
          <ScreenSkeleton rows={2} />
        </section>
      </main>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
