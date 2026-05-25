import {
  VIDEO_CATEGORIES,
  VIDEO_CATEGORY_LABEL,
  type VideoCategory,
} from '../services/feed.service';

interface CategoryPickerProps {
  value: VideoCategory;
  disabled?: boolean;
  onChange: (value: VideoCategory) => void;
}

export function CategoryPicker({ value, disabled = false, onChange }: CategoryPickerProps) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-bold uppercase tracking-wide text-emerald-300">
        Categoria
      </span>
      <select
        className="min-h-[48px] rounded-xl border border-slate-700 bg-slate-950 px-3 text-slate-50 outline-none transition focus:border-emerald-300 disabled:opacity-60"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as VideoCategory)}
      >
        {VIDEO_CATEGORIES.map((category) => (
          <option key={category} value={category}>
            {VIDEO_CATEGORY_LABEL[category]}
          </option>
        ))}
      </select>
    </label>
  );
}
