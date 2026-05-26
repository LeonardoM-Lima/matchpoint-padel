import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ErrorBanner } from '../components/ErrorBanner';
import { Icon } from '../components/Icon';
import { authService } from '../services/auth.service';

export function ResetPasswordScreen() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    authService
      .preparePasswordRecoverySession()
      .then((session) => {
        if (!active) return;

        setSessionReady(Boolean(session));
        if (!session) {
          setError('Abra esta tela pelo link de recuperação enviado por email.');
        }
      })
      .catch(() => {
        if (!active) return;
        setSessionReady(false);
        setError('Este link de recuperação expirou ou já foi usado. Solicite um novo link.');
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!sessionReady) {
      setError('Abra esta tela pelo link de recuperação enviado por email.');
      return;
    }

    if (password.length < 6) {
      setError('Use uma senha com pelo menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não conferem.');
      return;
    }

    setSubmitting(true);
    try {
      await authService.updatePassword(password);
      navigate('/login', { replace: true });
    } catch (nextError) {
      if (nextError instanceof Error) {
        const message = nextError.message.toLowerCase();
        if (message.includes('same password')) {
          setError('A nova senha precisa ser diferente da senha atual.');
          return;
        }

        if (message.includes('future') || message.includes('jwt')) {
          setError('Não foi possível validar a sessão de recuperação. Solicite um novo link e abra no mesmo navegador.');
          return;
        }
      }

      setError('Não foi possível atualizar sua senha. Solicite um novo link de recuperação.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-8 text-slate-50">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md animate-fade-in flex-col justify-center gap-6">
        <header className="grid gap-3 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-300/15 text-emerald-300 ring-1 ring-emerald-300/25">
            <Icon name="lock" size={30} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">
              PadelUP
            </p>
            <h1 className="mt-2 font-display text-3xl font-extrabold text-slate-50">
              Nova senha
            </h1>
          </div>
        </header>

        <form className="grid gap-4" onSubmit={handleSubmit}>
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
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:text-emerald-300"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                <Icon name={showPassword ? 'eyeOff' : 'eye'} size={18} />
              </button>
            </div>
          </label>

          <label className="grid gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-300">
              Confirmar senha
            </span>
            <input
              className="min-h-[48px] w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 text-slate-50 outline-none transition focus:border-emerald-300"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </label>

          {error ? <ErrorBanner message={error} /> : null}

          <button
            className="btn-primary inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl px-4 disabled:opacity-60"
            type="submit"
            disabled={checkingSession || submitting || !sessionReady}
          >
            {checkingSession ? 'Validando link...' : submitting ? 'Salvando...' : 'Salvar nova senha'}
          </button>
        </form>

        <Link className="text-center text-sm font-bold text-emerald-300" to="/login">
          Voltar ao login
        </Link>
      </section>
    </main>
  );
}
