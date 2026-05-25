import { useVideoLike } from '../hooks/useVideoLike';
import { Icon } from './Icon';

interface LikeButtonProps {
  videoId: string;
  profileId?: string;
  initialLiked: boolean;
  initialCount: number;
  onError?: (message: string) => void;
}

export function LikeButton({
  videoId,
  profileId,
  initialLiked,
  initialCount,
  onError,
}: LikeButtonProps) {
  const { liked, count, saving, toggle } = useVideoLike({
    videoId,
    profileId,
    initialLiked,
    initialCount,
    onError,
  });

  return (
    <button
      type="button"
      className={[
        'inline-flex min-h-[40px] items-center gap-2 rounded-xl px-3 text-sm font-bold transition disabled:opacity-60',
        liked
          ? 'bg-rose-300/15 text-rose-200 ring-1 ring-rose-300/30'
          : 'bg-slate-950/80 text-slate-300 ring-1 ring-slate-800 hover:text-rose-200',
      ].join(' ')}
      disabled={saving || !profileId}
      onClick={() => {
        void toggle();
      }}
      aria-pressed={liked}
    >
      <Icon name={liked ? 'heartFilled' : 'heart'} size={17} />
      {count}
    </button>
  );
}
