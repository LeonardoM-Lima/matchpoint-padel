import { useCallback, useEffect, useState } from 'react';
import { getFeed, type FeedItem } from '../services/feed.service';

const PAGE_SIZE = 20;

export function useFeed() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(async (offset: number, append: boolean) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const page = await getFeed(PAGE_SIZE, offset);
      setItems((current) => (append ? [...current, ...page] : page));
      setHasMore(page.length === PAGE_SIZE);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Não foi possível carregar o feed.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  const refresh = useCallback(() => loadPage(0, false), [loadPage]);

  const nextPage = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    void loadPage(items.length, true);
  }, [hasMore, items.length, loadPage, loading, loadingMore]);

  const removeItem = useCallback((videoId: string) => {
    setItems((current) => current.filter((item) => item.id !== videoId));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    items,
    loading,
    loadingMore,
    hasMore,
    error,
    nextPage,
    refresh,
    removeItem,
  };
}
