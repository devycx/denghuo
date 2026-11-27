import { useEffect, useState } from 'react';
import { VideoCard } from '../components/VideoCard';
import { Empty } from '../components/States';
import { navigate, useRoute } from '../router';
import { useStore } from '../store';
import type { SearchItem } from '../types';

type Tab = 'history' | 'favorites';

export function Library() {
  const { history, favorites, clearHistory } = useStore();
  const route = useRoute();
  const [tab, setTab] = useState<Tab>(route.params.get('tab') === 'favorites' ? 'favorites' : 'history');
  useEffect(() => {
    setTab(route.params.get('tab') === 'favorites' ? 'favorites' : 'history');
  }, [route.params]);

  const asItem = (entry: { sourceKey: string; vodId: string; title: string; pic?: string; epName?: string }): SearchItem => ({
    sourceKey: entry.sourceKey,
    sourceName: '',
    vodId: entry.vodId,
    name: entry.title,
    pic: entry.pic,
    remarks: entry.epName,
  });

  const entries = tab === 'history' ? history : favorites;

  return (
    <div className="page">
      <div className="library-tabs">
        <button className={tab === 'history' ? 'on' : ''} onClick={() => setTab('history')}>历史记录</button>
        <button className={tab === 'favorites' ? 'on' : ''} onClick={() => setTab('favorites')}>我的收藏</button>
        {tab === 'history' && history.length > 0 && (
          <button className="library-clear" onClick={clearHistory}>清空</button>
        )}
      </div>

      <div className="library-body">
        {entries.length === 0 ? (
          <Empty text={tab === 'history' ? '暂无历史记录' : '暂无收藏'} />
        ) : (
          <div className="grid">
            {entries.map((entry) => (
              <div className="library-entry" key={entry.key}>
                <VideoCard item={asItem(entry)} />
                {tab === 'history' && 'epIndex' in entry && (
                  <button
                    className="btn small"
                    onClick={() => navigate(`/watch?source=${entry.sourceKey}&id=${entry.vodId}&ep=${entry.epIndex}`)}
                  >
                    继续播放
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
