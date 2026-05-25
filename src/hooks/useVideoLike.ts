import { useState } from 'react';
import { likeVideo, unlikeVideo } from '../services/feed.service';

export function useVideoLike(params: {
  videoId: string;
  profileId?: string;
  initialLiked: boolean;
  initialCount: number;
  onError?: (message: string) => void;
}) {
  const [liked, setLiked] = useState(params.initialLiked);
  const [count, setCount] = useState(params.initialCount);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    if (!params.profileId || saving) return;

    const previousLiked = liked;
    const previousCount = count;
    const nextLiked = !previousLiked;

    setLiked(nextLiked);
    setCount(Math.max(0, previousCount + (nextLiked ? 1 : -1)));
    setSaving(true);

    try {
      if (nextLiked) {
        await likeVideo(params.videoId, params.profileId);
      } else {
        await unlikeVideo(params.videoId);
      }
    } catch {
      setLiked(previousLiked);
      setCount(previousCount);
      params.onError?.('Não foi possível atualizar a curtida.');
    } finally {
      setSaving(false);
    }
  }

  return {
    liked,
    count,
    saving,
    toggle,
  };
}
