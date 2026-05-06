import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api.js';

/**
 * Generic data-fetching hook.
 *
 * @param {string|null} path  - API path, e.g. '/investments'. Pass null to skip fetch.
 * @param {Array}       deps  - Extra dependencies that trigger a re-fetch when changed.
 * @returns {{ data, loading, error, refetch }}
 */
export function useApi(path, deps = []) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(path != null);
  const [error, setError]     = useState(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetch = useCallback(async () => {
    if (path == null) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.get(path);
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [path, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

/**
 * Convenience hook that returns a mutation function plus status flags.
 * Usage:
 *   const { mutate, loading, error } = useMutation((body) => api.post('/loans', body));
 */
export function useMutation(mutationFn) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const mutate = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const result = await mutationFn(...args);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [mutationFn]);

  return { mutate, loading, error };
}
