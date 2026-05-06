interface ErrorBannerProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function ErrorBanner({ message, actionLabel, onAction }: ErrorBannerProps) {
  return (
    <section className="grid gap-3 rounded-lg border border-red-400/40 bg-red-950/60 p-4">
      <p className="text-sm text-red-100">{message}</p>
      {actionLabel && onAction ? (
        <button
          className="min-h-[44px] rounded-lg bg-slate-50 px-4 py-3 font-semibold text-slate-950"
          type="button"
          onClick={onAction}
        >
          {actionLabel}
        </button>
      ) : null}
    </section>
  );
}
