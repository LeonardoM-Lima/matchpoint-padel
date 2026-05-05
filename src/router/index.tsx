import { createBrowserRouter, Link } from 'react-router-dom';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { useAuth } from '../contexts/AuthContext';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';

function ProtectedPlaceholder({ title }: { title: string }) {
  const { profile, signOut } = useAuth();

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-50">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-md flex-col gap-6">
        <header className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-300">
            MatchPoint Padel
          </p>
          <h1 className="text-3xl font-bold">{title}</h1>
          {profile ? (
            <p className="text-slate-300">
              {profile.name} · {profile.points} pontos
            </p>
          ) : null}
        </header>

        <nav className="grid gap-3">
          <Link className="rounded-lg bg-slate-800 px-4 py-3 text-center font-semibold" to="/">
            Home
          </Link>
          <Link className="rounded-lg bg-slate-800 px-4 py-3 text-center font-semibold" to="/match/new">
            Registrar partida
          </Link>
          <Link className="rounded-lg bg-slate-800 px-4 py-3 text-center font-semibold" to="/ranking">
            Ranking
          </Link>
          <Link className="rounded-lg bg-slate-800 px-4 py-3 text-center font-semibold" to="/matchmaking">
            Matchmaking
          </Link>
          <Link className="rounded-lg bg-slate-800 px-4 py-3 text-center font-semibold" to="/profile">
            Perfil
          </Link>
        </nav>

        <button
          className="mt-auto min-h-[44px] rounded-lg bg-emerald-400 px-4 py-3 font-semibold text-slate-950"
          type="button"
          onClick={() => {
            void signOut();
          }}
        >
          Sair
        </button>
      </section>
    </main>
  );
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginScreen />,
  },
  {
    path: '/register',
    element: <RegisterScreen />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/',
        element: <ProtectedPlaceholder title="Home" />,
      },
      {
        path: '/match/new',
        element: <ProtectedPlaceholder title="Registrar partida" />,
      },
      {
        path: '/ranking',
        element: <ProtectedPlaceholder title="Ranking" />,
      },
      {
        path: '/matchmaking',
        element: <ProtectedPlaceholder title="Matchmaking" />,
      },
      {
        path: '/profile',
        element: <ProtectedPlaceholder title="Perfil" />,
      },
    ],
  },
]);
