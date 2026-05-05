import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function ProtectedRoute() {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
        <p>Carregando...</p>
      </main>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
