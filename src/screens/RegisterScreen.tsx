import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ErrorBanner } from '../components/ErrorBanner';
import { Icon } from '../components/Icon';
import { useAuth } from '../contexts/AuthContext';
import { getAuthErrorMessage } from '../services/auth.service';

export function RegisterScreen() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const result = await signUp(email, password, nickname);

      if (result.needsEmailConfirmation) {
        setNotice('Conta criada. Confira seu email para confirmar o cadastro antes de entrar.');
        setPassword('');
        return;
      }

      navigate('/', { replace: true });
    } catch (error) {
      setError(getAuthErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-8 text-slate-50">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center gap-8 animate-fade-in">
        <header className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-emerald shadow-glow">
            <Icon name="sparkles" size={40} strokeWidth={2} className="text-emerald-950" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-emerald-300">
              PadelUP
            </p>
            <h1 className="mt-2 font-display text-4xl font-extrabold text-gradient-emerald">
              Criar conta
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Junte-se à comunidade de padel e comece a registrar suas partidas
            </p>
          </div>
        </header>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-300">
              Nickname
            </span>
            <div className="relative">
              <Icon
                name="user"
                size={18}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                className="min-h-[48px] w-full rounded-xl border border-slate-700 bg-slate-900/60 pl-10 pr-3 text-slate-50 outline-none transition focus:border-emerald-300"
                type="text"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                required
              />
            </div>
          </label>

          <label className="grid gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-300">Email</span>
            <div className="relative">
              <Icon
                name="mail"
                size={18}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                className="min-h-[48px] w-full rounded-xl border border-slate-700 bg-slate-900/60 pl-10 pr-3 text-slate-50 outline-none transition focus:border-emerald-300"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
          </label>

          <label className="grid gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-300">Senha</span>
            <div className="relative">
              <Icon
                name="lock"
                size={18}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                className="min-h-[48px] w-full rounded-xl border border-slate-700 bg-slate-900/60 pl-10 pr-12 text-slate-50 outline-none transition focus:border-emerald-300"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={6}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:text-emerald-300"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                <Icon name={showPassword ? 'eyeOff' : 'eye'} size={18} />
              </button>
            </div>
          </label>

          {notice ? (
            <p className="flex items-start gap-2 rounded-xl border border-emerald-300/40 bg-emerald-950/40 px-3 py-3 text-sm text-emerald-100">
              <Icon name="checkCircle" size={18} className="mt-0.5 shrink-0 text-emerald-300" />
              {notice}
            </p>
          ) : null}

          {error ? <ErrorBanner message={error} /> : null}

          <button
            className="btn-primary mt-2 inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl px-4 disabled:opacity-60"
            type="submit"
            disabled={submitting}
          >
            {submitting ? (
              'Criando...'
            ) : (
              <>
                Criar conta
                <Icon name="sparkles" size={18} strokeWidth={2.5} />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-sm text-slate-400">
          Já tem conta?{' '}
          <Link className="font-bold text-emerald-300 hover:text-emerald-200" to="/login">
            Entrar
          </Link>
        </p>
      </section>
    </main>
  );
}
