import { useState } from 'react';
import { img } from '../api';
import { VideoCard } from '../components/VideoCard';
import { Empty } from '../components/States';
import { navigate } from '../router';
import { useStore } from '../store';
import type { SearchItem } from '../types';

type Tab = 'history' | 'favorites';

export function Library() {
  const { history, favorites, clearHistory } = useStore();
  const [tab, setTab] = useState<Tab>('history');

  const asItem = (entry: { sourceKey: string; vodId: string; title: string; pic?: string; epName?: string; sourceName?: string }): SearchItem => ({
    sourceKey: entry.sourceKey,
    sourceName: entry.sourceName || (tab === 'history' ? '最近观看' : '我的收藏'),
    vodId: entry.vodId,
    name: entry.title,
    pic: entry.pic,
    remarks: entry.epName,
  });

  const entries = tab === 'history' ? history : favorites;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>我的片单</h1>
          <p className="muted">仅保存在本机浏览器，不上传、不追踪。</p>
        </div>
        {tab === 'history' && history.length > 0 && (
          <button className="btn ghost" onClick={clearHistory}>
            清空观看记录
          </button>
        )}
      </div>

      <div className="line-tabs large">
        <button className={tab === 'history' ? 'on' : ''} onClick={() => setTab('history')}>
          观看记录 · {history.length}
        </button>
        <button className={tab === 'favorites' ? 'on' : ''} onClick={() => setTab('favorites')}>
          我的收藏 · {favorites.length}
        </button>
      </div>

      {entries.length === 0 ? (
        <Empty text={tab === 'history' ? '还没有观看记录' : '还没有收藏的影片'} />
      ) : (
        <div className="grid">
          {entries.map((entry) => (
            <div className="library-entry" key={entry.key}>
              <VideoCard item={asItem(entry)} />
              {tab === 'history' && 'epIndex' in entry && (
                <button
                  className="btn small"
                  onClick={() =>
                    navigate(
                      `/watch?source=${entry.sourceKey}&id=${entry.vodId}&ep=${entry.epIndex}`
                    )
                  }
                >
                  继续播放
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'favorites' && favorites.length > 0 && (
        <p className="muted footer-note">
          封面通过 <code>{'{'} /api/image?url=... {'}'}</code> 代理：{img(favorites[0].pic) ? '已启用边缘缓存' : ''}
        </p>
      )}
    </div>
  );
}
