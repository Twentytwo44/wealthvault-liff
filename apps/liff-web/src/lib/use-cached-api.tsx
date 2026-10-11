"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { apiRequest, errorMessage } from "./api-client";
import { loadCachedQuery, readCachedQuery, writeCachedQuery } from "./query-cache";

const CacheScope = createContext<string | null>(null);

export function CachedApiProvider({ userId, children }: { userId: string; children: ReactNode }) {
  return <CacheScope.Provider value={userId}>{children}</CacheScope.Provider>;
}

type QueryState = {
  key: string;
  data: unknown;
  hasData: boolean;
  loading: boolean;
  refreshing: boolean;
  error: string;
};

function initialState(key: string, staleAfterMs: number, showStale: boolean): QueryState {
  const cached = readCachedQuery<unknown>(key, staleAfterMs);
  const visible = cached !== null && (cached.fresh || showStale);
  return {
    key,
    data: visible ? cached.value : undefined,
    hasData: visible,
    loading: !visible,
    refreshing: false,
    error: ""
  };
}

export function useCachedApi(path: string, staleAfterMs: number, showStale = true) {
  const scope = useContext(CacheScope);
  if (scope === null) throw new Error("useCachedApi requires CachedApiProvider");
  const key = `${scope}:${path}`;
  const [state, setState] = useState<QueryState>(() => initialState(key, staleAfterMs, showStale));
  const generation = useRef(0);

  const load = useCallback(async (force = false) => {
    const thisGeneration = ++generation.current;
    const cached = readCachedQuery<unknown>(key, staleAfterMs);
    const visible = cached !== null && (cached.fresh || showStale || force);
    setState({
      key,
      data: visible ? cached.value : undefined,
      hasData: visible,
      loading: !visible,
      refreshing: visible && (force || !cached?.fresh),
      error: ""
    });
    if (!force && cached?.fresh) return;

    try {
      const data = await loadCachedQuery(key, staleAfterMs, () => apiRequest(path), force);
      if (generation.current === thisGeneration) {
        setState({ key, data, hasData: true, loading: false, refreshing: false, error: "" });
      }
    } catch (cause) {
      if (generation.current === thisGeneration) {
        setState((current) => ({ ...current, loading: false, refreshing: false, error: errorMessage(cause) }));
      }
    }
  }, [key, path, showStale, staleAfterMs]);

  useEffect(() => {
    void load();
    return () => { generation.current += 1; };
  }, [load]);

  const update = useCallback((data: unknown) => {
    generation.current += 1;
    writeCachedQuery(key, data);
    setState({ key, data, hasData: true, loading: false, refreshing: false, error: "" });
  }, [key]);

  const current = state.key === key ? state : initialState(key, staleAfterMs, showStale);
  return {
    data: current.hasData ? current.data : null,
    loading: current.loading,
    refreshing: current.refreshing,
    error: current.error,
    refresh: () => load(true),
    update
  };
}
