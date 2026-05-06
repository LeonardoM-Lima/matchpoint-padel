import { FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ErrorBanner } from '../components/ErrorBanner';
import { useAuth } from '../contexts/AuthContext';

interface LocationState {
  from?: {
    pathname?: string;
  };
}

export function LoginScreen() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await signIn(email, password);
      navigate(state?.from?.pathname ?? '/', { replace: true });
    } catch {
      setError('Email ou senha invalidos.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center gap-8">
        <header className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-300">
            MatchPoint Padel
          </p>
          <h1 className="text-3xl font-bold">Entrar</h1>
        </header>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-200">Email</span>
            <input
              className="min-h-[44px] rounded-lg border border-slate-700 bg-slate-900 px-3 text-slate-50 outline-none focus:border-emerald-300"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-200">Senha</span>
            <input
              className="min-h-[44px] rounded-lg border border-slate-700 bg-slate-900 px-3 text-slate-50 outline-none focus:border-emerald-300"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {error ? <ErrorBanner message={error} /> : null}

          <button
            className="min-h-[44px] rounded-lg bg-emerald-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-60"
            type="submit"
            disabled={submitting}
          >
            {submitting ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-300">
          Ainda nao tem conta?{' '}
          <Link className="font-semibold text-emerald-300" to="/register">
            Criar conta
          </Link>
        </p>
      </section>
    </main>
  );
}
