import { Icon } from './Icon';

interface ErrorBannerProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function ErrorBanner({ message, actionLabel, onAction }: ErrorBannerProps) {
  return (
    <section className="flex items-start gap-3 rounded-2xl border border-rose-400/30 bg-gradient-to-br from-rose-950/70 to-slate-950/70 p-4 animate-fade-in">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/20 text-rose-300 ring-1 ring-rose-400/30">
        <Icon name="alert" size={18} />
      </span>
      <div className="grid flex-1 gap-3">
        <p className="text-sm text-rose-100">{message}</p>
        {actionLabel && onAction ? (
          <button
            className="inline-flex min-h-[40px] items-center justify-center gap-2 self-start rounded-lg bg-rose-100 px-4 font-semibold text-rose-900 transition hover:bg-white"
            type="button"
            onClick={onAction}
          >
            <Icon name="refresh" size={16} />
            {actionLabel}
          </button>
        ) : null}
      </div>
    </section>
  );
}
