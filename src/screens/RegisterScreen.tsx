import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getAuthErrorMessage } from '../services/auth.service';

export function RegisterScreen() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await signUp(email, password, nickname);
      navigate('/', { replace: true });
    } catch (error) {
      setError(getAuthErrorMessage(error));
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
          <h1 className="text-3xl font-bold">Criar conta</h1>
        </header>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-200">Nickname</span>
            <input
              className="min-h-[44px] rounded-lg border border-slate-700 bg-slate-900 px-3 text-slate-50 outline-none focus:border-emerald-300"
              type="text"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              required
            />
          </label>

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
              minLength={6}
              required
            />
          </label>

          {error ? (
            <p className="rounded-lg border border-red-400/40 bg-red-950/60 px-3 py-2 text-sm text-red-100">
              {error}
            </p>
          ) : null}

          <button
            className="min-h-[44px] rounded-lg bg-emerald-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-60"
            type="submit"
            disabled={submitting}
          >
            {submitting ? 'Criando...' : 'Criar conta'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-300">
          Ja tem conta?{' '}
          <Link className="font-semibold text-emerald-300" to="/login">
            Entrar
          </Link>
        </p>
      </section>
    </main>
  );
}
