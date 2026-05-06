import { Icon } from './Icon';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: 'users' | 'trophy' | 'racket' | 'sparkles' | 'search';
}

export function EmptyState({ title, description, icon = 'sparkles' }: EmptyStateProps) {
  return (
    <section className="flex flex-col items-center gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/50 p-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-300/20">
        <Icon name={icon} size={28} />
      </div>
      <div>
        <h2 className="font-bold text-slate-50">{title}</h2>
        <p className="mt-1 text-sm text-slate-400">{description}</p>
      </div>
    </section>
  );
}
