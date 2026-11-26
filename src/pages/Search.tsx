import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { VideoCard } from '../components/VideoCard';
import { Empty, ErrorState, Loading } from '../components/States';
import { useRoute } from '../router';
import { useStore } from '../store';
import type { SearchItem } from '../types';

type SortMode = 'smart' | 'year' | 'name';

export function SearchPage() {
  const route = useRoute();
  const q = route.params.get('q') || '';
  const { config, settings, updateSettings } = useStore();
  const [list, setList] = useState<SearchItem[] | null>(null);
  const [sourceCount, setSourceCount] = useState(0);
  const [error, setError] = useState('');
  const [sort, setSort] = useState<SortMode>('smart');

  useEffect(() => {
    if (!q) {
      setList([]);
      return;
    }
    let alive = true;
    setList(null);
    setError('');
    api
      .search(q, settings.selectedSources.length ? settings.selectedSources : undefined, settings.adultFilter)
      .then((res) => {
        if (!alive) return;
        setList(res.list);
        setSourceCount(res.sourceCount);
      })
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [q, settings.selectedSources, settings.adultFilter]);

  const sorted = useMemo(() => {
    const items = [...(list || [])];
    if (sort === 'year') items.sort((a, b) => Number(b.year || 0) - Number(a.year || 0));
    if (sort === 'name') items.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    return items;
  }, [list, sort]);

  const toggleSource = (key: string) => {
    const current = settings.selectedSources;
    updateSettings({
      selectedSources: current.includes(key) ? current.filter((k) => k !== key) : [...current, key],
    });
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>搜索 “{q}”</h1>
          <p className="muted">{list ? `${list.length} 条结果 · 来自 ${sourceCount} 个源` : '多源并行检索中'}</p>
        </div>
        <label className="select-wrap">
          排序
          <select value={sort} onChange={(e) => setSort(e.target.value as SortMode)}>
            <option value="smart">智能相关</option>
            <option value="year">年份最新</option>
            <option value="name">片名</option>
          </select>
        </label>
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
            title={s.url}
          >
            {s.name}
          </button>
        ))}
      </div>

      {error && <ErrorState message={error} onRetry={() => window.location.reload()} />}
      {!list && !error && <Loading text="正在并行检索所有资源源……" />}
      {list?.length === 0 && <Empty text="没有找到匹配的内容，换个关键词试试。" />}
      {sorted.length > 0 && (
        <div className="grid">
          {sorted.map((item) => (
            <VideoCard key={`${item.sourceKey}:${item.vodId}`} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
