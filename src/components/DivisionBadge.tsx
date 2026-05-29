import type { DivisionOrNone } from '../../specs/001-matchpoint-mvp/contracts/types';

const divisionStyles: Record<NonNullable<DivisionOrNone>, string> = {
  'Divisão 1': 'bg-amber-400/15 text-amber-200 ring-amber-300/30',
  'Divisão 2': 'bg-emerald-400/15 text-emerald-200 ring-emerald-300/30',
  'Divisão 3': 'bg-sky-400/15 text-sky-200 ring-sky-300/30',
};

interface DivisionBadgeProps {
  division: DivisionOrNone;
  className?: string;
}

export function DivisionBadge({ division, className = '' }: DivisionBadgeProps) {
  if (!division) return null;

  return (
    <span
      className={[
        'inline-flex items-center rounded-full font-semibold ring-1',
        divisionStyles[division],
        className || 'px-2.5 py-1 text-xs',
      ].join(' ')}
    >
      {division}
    </span>
  );
}
