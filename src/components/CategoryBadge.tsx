import type { PlayerCategory } from '../../specs/002-perfil-e-ligas/contracts/types';

const labels: Record<PlayerCategory, string> = {
  '1a': '1ª',
  '2a': '2ª',
  '3a': '3ª',
  '4a': '4ª',
  '5a': '5ª',
  '6a': '6ª',
  Open: 'Open',
  Iniciante: 'Iniciante',
};

const styles: Record<PlayerCategory, string> = {
  '1a': 'bg-amber-300/15 text-amber-200 ring-amber-300/30',
  '2a': 'bg-orange-300/15 text-orange-200 ring-orange-300/30',
  '3a': 'bg-fuchsia-300/15 text-fuchsia-200 ring-fuchsia-300/30',
  '4a': 'bg-sky-300/15 text-sky-200 ring-sky-300/30',
  '5a': 'bg-cyan-300/15 text-cyan-200 ring-cyan-300/30',
  '6a': 'bg-teal-300/15 text-teal-200 ring-teal-300/30',
  Open: 'bg-emerald-300/15 text-emerald-200 ring-emerald-300/30',
  Iniciante: 'bg-slate-300/15 text-slate-200 ring-slate-300/30',
};

interface CategoryBadgeProps {
  category?: PlayerCategory | null;
}

export function CategoryBadge({ category }: CategoryBadgeProps) {
  if (!category) return null;

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${styles[category]}`}>
      {labels[category]}
    </span>
  );
}

export const playerCategoryOptions = Object.entries(labels).map(([value, label]) => ({
  value: value as PlayerCategory,
  label,
}));
