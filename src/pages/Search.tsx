import { useEffect, useState } from 'react';
import { api } from '../api';
import { VideoCard } from '../components/VideoCard';
import { Empty, ErrorState } from '../components/States';
import { useRoute } from '../router';
import { useStore } from '../store';
import type { SearchItem } from '../types';

export function SearchPage() {
  const route = useRoute();
  const q = route.params.get('q') || '';
  const { config, settings, updateSettings } = useStore();
  const [items, setItems] = useState<SearchItem[]>([]);
  const [pending, setPending] = useState(0);
  const [done, setDone] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!q) {
      setItems([]);
      setPending(0);
      return;
    }
    let alive = true;
    const sources = (config?.sources || []).filter((s) => {
      if (settings.adultFilter && s.isAdult) return false;
      return settings.selectedSources.length === 0 || settings.selectedSources.includes(s.key);
    });
    setItems([]);
    setDone(0);
    setPending(sources.length);
    setError('');

    // 每个源独立请求，谁先回来就默默追加到列表末尾，不重排已有结果。
    for (const source of sources) {
      api
        .search(q, [source.key], settings.adultFilter)
        .then((res) => {
          if (!alive) return;
          setItems((prev) => [...prev, ...res.list]);
          setDone((n) => n + 1);
          setPending((n) => n - 1);
        })
        .catch(() => {
          if (!alive) return;
          setDone((n) => n + 1);
          setPending((n) => n - 1);
        });
    }
    return () => {
      alive = false;
    };
  }, [q, config?.sources, settings.selectedSources, settings.adultFilter]);

  const toggleSource = (key: string) => {
    const current = settings.selectedSources;
    updateSettings({
      selectedSources: current.includes(key) ? current.filter((k) => k !== key) : [...current, key],
    });
  };

  const loading = !config || pending > 0;
  const unique = Array.from(new Map(items.map((item) => [`${item.sourceKey}:${item.vodId}`, item])).values());

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>搜索 “{q}”</h1>
          <p className="muted">
            {loading
              ? `已收到 ${unique.length} 条 · 还有 ${pending} 个源在检索`
              : `${unique.length} 条结果`}
          </p>
        </div>
      </div>

      <div className="filter-bar">
        <span className="filter-title">资源源</span>
        <button className={`chip ${settings.selectedSources.length === 0 ? 'on' : ''}`} onClick={() => updateSettings({ selectedSources: [] })}>
          全部
        </button>
        {config?.sources.map((s) => (
          <button
            key={s.key}
            className={`chip ${settings.selectedSources.includes(s.key) ? 'on' : ''}`}
            onClick={() => toggleSource(s.key)}
          >
            {s.name}
          </button>
        ))}
      </div>

      {error && <ErrorState message={error} onRetry={() => window.location.reload()} />}

      <div className="grid">
        {unique.map((item) => (
          <VideoCard key={`${item.sourceKey}:${item.vodId}`} item={item} />
        ))}
        {loading &&
          Array.from({ length: Math.min(pending * 2 || 8, 12) }, (_, i) => (
            <div key={`sk-${i}`} className="skeleton-card" aria-hidden="true" />
          ))}
      </div>

      {!loading && unique.length === 0 && <Empty text="没有找到匹配的内容，换个关键词试试。" />}
      {done > 0 && pending === 0 && unique.length > 0 && (
        <p className="muted search-done">已检索全部 {done} 个源</p>
      )}
    </div>
  );
}
