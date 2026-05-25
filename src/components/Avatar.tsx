import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

interface AvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: number;
  ring?: boolean;
  className?: string;
}

const palettes = [
  'from-emerald-400 to-teal-500',
  'from-sky-400 to-indigo-500',
  'from-fuchsia-400 to-purple-600',
  'from-amber-400 to-orange-500',
  'from-rose-400 to-pink-600',
  'from-lime-400 to-emerald-500',
  'from-cyan-400 to-blue-500',
  'from-violet-400 to-fuchsia-500',
  'from-yellow-400 to-amber-500',
  'from-teal-400 to-cyan-600',
];

function hashName(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getInitials(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function Avatar({ name, avatarUrl, size = 44, ring = false, className = '' }: AvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const palette = palettes[hashName(name) % palettes.length];
  const initials = getInitials(name);
  const fontSize = Math.max(12, Math.round(size * 0.38));

  useEffect(() => {
    setImageFailed(false);
  }, [avatarUrl]);

  const publicUrl = useMemo(() => {
    if (!avatarUrl) return null;

    const { data } = supabase.storage.from('avatars').getPublicUrl(avatarUrl);
    return data.publicUrl;
  }, [avatarUrl]);

  if (publicUrl && !imageFailed) {
    return (
      <img
        className={[
          'shrink-0 rounded-full object-cover shadow-soft',
          ring ? 'ring-2 ring-emerald-300/60 ring-offset-2 ring-offset-slate-950' : '',
          className,
        ].join(' ')}
        src={publicUrl}
        alt={name}
        onError={() => setImageFailed(true)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={[
        'flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-bold text-white shadow-soft',
        palette,
        ring ? 'ring-2 ring-emerald-300/60 ring-offset-2 ring-offset-slate-950' : '',
        className,
      ].join(' ')}
      style={{ width: size, height: size, fontSize }}
      aria-label={name}
    >
      {initials}
    </div>
  );
}
