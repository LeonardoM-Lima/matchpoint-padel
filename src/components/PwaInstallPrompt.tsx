import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Icon } from './Icon';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISSED_KEY = 'padelup-pwa-install-dismissed';

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  const userAgent = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(userAgent);
}

export function PwaInstallPrompt() {
  const { session, loading } = useAuth();
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  const canShowIosInstructions = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return isIos() && !isStandalone();
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setVisible(false);
      localStorage.setItem(DISMISSED_KEY, 'installed');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (loading || !session || isStandalone()) {
      setVisible(false);
      return;
    }

    if (localStorage.getItem(DISMISSED_KEY)) {
      return;
    }

    if (installPrompt || canShowIosInstructions) {
      const timeout = window.setTimeout(() => setVisible(true), 900);
      return () => window.clearTimeout(timeout);
    }
  }, [canShowIosInstructions, installPrompt, loading, session]);

  async function handleInstall() {
    if (!installPrompt) return;

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;

    if (choice.outcome === 'accepted') {
      localStorage.setItem(DISMISSED_KEY, 'accepted');
    }

    setInstallPrompt(null);
    setVisible(false);
  }

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, 'dismissed');
    setVisible(false);
  }

  if (!visible) return null;

  const isNativePromptAvailable = Boolean(installPrompt);

  return (
    <section className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm rounded-3xl border border-emerald-300/30 bg-slate-950 p-5 text-slate-50 shadow-glow">
        <div className="flex items-start justify-between gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-300/15 text-emerald-300 ring-1 ring-emerald-300/25">
            <Icon name="smartphone" size={23} />
          </span>

          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-800 text-slate-400 transition hover:border-slate-600 hover:text-slate-200"
            aria-label="Fechar aviso de instalação"
            onClick={handleDismiss}
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="mt-4">
          <h2 className="text-lg font-extrabold leading-tight text-slate-50">
            Adicionar à tela inicial
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Abra o PadelUP como app, com ícone próprio e tela cheia.
          </p>
        </div>

        {isNativePromptAvailable ? (
          <div className="mt-5 grid grid-cols-[1fr_auto] gap-2">
            <button
              type="button"
              className="btn-primary inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl px-4 text-sm"
              onClick={() => {
                void handleInstall();
              }}
            >
              <Icon name="download" size={17} />
              Adicionar app
            </button>
            <button
              type="button"
              className="inline-flex min-h-[46px] items-center justify-center rounded-xl border border-slate-800 px-3 text-xs font-bold text-slate-300"
              onClick={handleDismiss}
            >
              Agora não
            </button>
          </div>
        ) : (
          <p className="mt-5 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs leading-5 text-slate-300">
            No iPhone, toque em Compartilhar e escolha Adicionar à Tela de Início.
          </p>
        )}
      </div>
    </section>
  );
}
