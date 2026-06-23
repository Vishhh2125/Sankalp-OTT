import { useState, useCallback, useEffect } from 'react';

export function useSkeleton(fetchFn, options = {}) {
  const { initialData = null, deps = [], enabled = true } = options;

  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(true); // True only on initial fetch
  const [isRefreshing, setIsRefreshing] = useState(false); // True during background refresh
  const [error, setError] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!enabled) return;

    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const result = await fetchFn();
      setData(result);
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || 'An error occurred'
      );
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [enabled, fetchFn, ...deps]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  return {
    data,
    setData,
    loading,
    isRefreshing,
    error,
    refresh,
  };
}
