interface EmptyStateProps {
  title: string;
  description: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
      <h2 className="font-semibold text-slate-50">{title}</h2>
      <p className="mt-1 text-sm text-slate-400">{description}</p>
    </section>
  );
}
