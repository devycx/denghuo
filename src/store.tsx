import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, setAdminToken } from './api';
import type { FavoriteEntry, HistoryEntry, Settings, SiteConfig } from './types';

const STORAGE_KEY = 'denghuo:v1';

export const entryKey = (sourceKey: string, vodId: string): string => `${sourceKey}:${vodId}`;

const defaultSettings: Settings = {
  theme: 'dark',
  adultFilter: true,
  autoplay: true,
  selectedSources: [],
};

interface Persisted {
  favorites: FavoriteEntry[];
  history: HistoryEntry[];
  settings: Settings;
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { favorites: [], history: [], settings: defaultSettings };
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return {
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
      history: Array.isArray(parsed.history) ? parsed.history : [],
      settings: { ...defaultSettings, ...(parsed.settings || {}) },
    };
  } catch {
    return { favorites: [], history: [], settings: defaultSettings };
  }
}

interface StoreValue extends Persisted {
  config: SiteConfig | null;
  refreshConfig: () => Promise<void>;
  toggleFavorite: (entry: Omit<FavoriteEntry, 'addedAt'>) => void;
  isFavorite: (key: string) => boolean;
  saveHistory: (entry: Omit<HistoryEntry, 'updatedAt'>) => void;
  clearHistory: () => void;
  updateSettings: (patch: Partial<Settings>) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Persisted>(load);
  const [config, setConfig] = useState<SiteConfig | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    document.documentElement.dataset.theme = state.settings.theme;
  }, [state]);

  const refreshConfig = async () => {
    try {
      setConfig(await api.config());
    } catch {
      /* 配置拉取失败时页面仍可用，只是源列表为空 */
    }
  };
  useEffect(() => {
    void refreshConfig();
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      ...state,
      config,
      refreshConfig,
      isFavorite: (key) => state.favorites.some((f) => f.key === key),
      toggleFavorite: (entry) =>
        setState((s) => {
          const exists = s.favorites.some((f) => f.key === entry.key);
          return {
            ...s,
            favorites: exists
              ? s.favorites.filter((f) => f.key !== entry.key)
              : [{ ...entry, addedAt: Date.now() }, ...s.favorites],
          };
        }),
      saveHistory: (entry) =>
        setState((s) => ({
          ...s,
          history: [
            { ...entry, updatedAt: Date.now() },
            ...s.history.filter((h) => h.key !== entry.key),
          ].slice(0, 120),
        })),
      clearHistory: () => setState((s) => ({ ...s, history: [] })),
      updateSettings: (patch) =>
        setState((s) => ({ ...s, settings: { ...s.settings, ...patch } })),
    }),
    [state, config]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore 必须在 StoreProvider 内使用');
  return ctx;
}

export { setAdminToken };
