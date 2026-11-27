import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { VideoCard } from '../components/VideoCard';
import { Empty, ErrorState } from '../components/States';
import { useRoute } from '../router';
import { useStore } from '../store';
import type { SearchItem } from '../types';

const cacheKey = (q: string) => `denghuo:search:v2:${q}`;
const scrollKey = 'denghuo:search:scroll';

function readCache(q: string): SearchItem[] | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(q));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at?: number; items?: SearchItem[] };
    if (!parsed.at || Date.now() - parsed.at > 30 * 60 * 1000 || !Array.isArray(parsed.items)) return null;
    return parsed.items;
  } catch {
    return null;
  }
}

export function SearchPage() {
  const route = useRoute();
  const q = route.params.get('q') || '';
  const { config, settings } = useStore();
  const [items, setItems] = useState<SearchItem[]>([]);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState('');
  const itemsRef = useRef<SearchItem[]>([]);

  useEffect(() => {
    if (!q) {
      setItems([]);
      itemsRef.current = [];
      return;
    }
    let alive = true;
    const cached = readCache(q);
    if (cached) {
      itemsRef.current = cached;
      setItems(cached);
      setPending(0);
      const y = Number(sessionStorage.getItem(scrollKey) || 0);
      requestAnimationFrame(() => window.scrollTo(0, y));
      return () => {
        alive = false;
      };
    }

    setItems([]);
    itemsRef.current = [];
    setError('');
    const sources = (config?.sources || []).filter((s) => !(settings.adultFilter && s.isAdult));
    setPending(sources.length);

    for (const source of sources) {
      api
        .search(q, [source.key], settings.adultFilter)
        .then((res) => {
          if (!alive) return;
          const next = [...itemsRef.current, ...res.list];
          itemsRef.current = next;
          setItems(next);
          setPending((n) => n - 1);
          try {
            sessionStorage.setItem(cacheKey(q), JSON.stringify({ at: Date.now(), items: next }));
          } catch {
            /* 隐私模式忽略 */
          }
        })
        .catch(() => alive && setPending((n) => n - 1));
    }

    return () => {
      alive = false;
      sessionStorage.setItem(scrollKey, String(window.scrollY));
    };
  }, [q, config?.sources, settings.adultFilter]);

  const loading = !config || pending > 0;

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>搜索 “{q}”</h1></div>
      </div>

      {error && <ErrorState message={error} onRetry={() => window.location.reload()} />}

      <div className="grid">
        {items.map((item) => (
          <VideoCard key={`${item.sourceKey}:${item.vodId}`} item={item} />
        ))}
        {loading &&
          Array.from({ length: Math.min(pending * 2 || 8, 12) }, (_, i) => (
            <div key={`sk-${i}`} className="skeleton-card" aria-hidden="true" />
          ))}
      </div>

      {!loading && items.length === 0 && <Empty text="没有找到匹配的内容，换个关键词试试。" />}
    </div>
  );
}
