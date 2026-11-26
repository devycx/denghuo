import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { Player } from '../components/Player';
import { Empty, ErrorState, Loading } from '../components/States';
import { toast } from '../components/Toast';
import type { LiveChannel } from '../types';

export function Live() {
  const [channels, setChannels] = useState<LiveChannel[] | null>(null);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [group, setGroup] = useState('全部');
  const [selected, setSelected] = useState<LiveChannel | null>(null);
  const [activeUrl, setActiveUrl] = useState('');
  const [urlIndex, setUrlIndex] = useState(0);
  const [probing, setProbing] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .channels()
      .then((res) => alive && setChannels(res.channels))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  const groups = useMemo(() => {
    const set = new Set<string>();
    channels?.forEach((ch) => ch.group && set.add(ch.group));
    return ['全部', ...Array.from(set).slice(0, 40)];
  }, [channels]);

  const visible = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return (channels || []).filter(
      (ch) =>
        (group === '全部' || ch.group === group) &&
        (!kw || ch.name.toLowerCase().includes(kw))
    );
  }, [channels, group, keyword]);

  const play = async (channel: LiveChannel) => {
    setSelected(channel);
    setUrlIndex(0);
    if (channel.urls.length <= 1) {
      setActiveUrl(channel.urls[0] || '');
      return;
    }
    setProbing(true);
    try {
      const res = await api.probe(channel.urls.slice(0, 8));
      const okIndex = res.results.findIndex((r) => r.ok);
      const index = okIndex >= 0 ? okIndex : 0;
      setUrlIndex(index);
      setActiveUrl(channel.urls[index] || '');
      if (okIndex < 0) toast('自动探测未成功，已尝试第一条线路');
    } catch (e) {
      setActiveUrl(channel.urls[0] || '');
      toast(e instanceof Error ? e.message : '探测失败');
    } finally {
      setProbing(false);
    }
  };

  const switchLine = () => {
    if (!selected || selected.urls.length < 2) return;
    const next = (urlIndex + 1) % selected.urls.length;
    setUrlIndex(next);
    setActiveUrl(selected.urls[next]);
  };

  return (
    <div className="page live-page">
      <div className="page-head">
        <div>
          <h1>电视直播</h1>
          <p className="muted">{channels ? `${channels.length} 个频道 · 按需探测，不浪费额度` : '正在加载订阅……'}</p>
        </div>
        <input
          className="live-search"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="筛选频道，如 CCTV"
          aria-label="筛选频道"
        />
      </div>

      {error && <ErrorState message={error} onRetry={() => window.location.reload()} />}
      {!channels && !error && <Loading text="正在聚合直播订阅……" />}
      {channels?.length === 0 && <Empty text="没有可用的直播订阅，请到设置里添加 M3U 地址。" />}

      <div className="live-layout">
        <div className="live-player-side">
          <div className="live-stage">
            {activeUrl ? (
              <Player url={activeUrl} title={selected?.name} poster={selected?.logo} live />
            ) : (
              <div className="live-placeholder">
                <span>◉</span>
                <p>{probing ? '正在探测可用线路……' : '点一个频道开始播放'}</p>
              </div>
            )}
          </div>
          {selected && (
            <div className="live-info">
              <div>
                <h2>{selected.name}</h2>
                <p className="muted">
                  {selected.group && `${selected.group} · `}
                  {selected.urls.length} 条线路 · {selected.sourceNames.join(' / ')}
                </p>
              </div>
              <button className="btn" onClick={switchLine} disabled={selected.urls.length < 2}>
                ⇄ 换线路
              </button>
            </div>
          )}
        </div>

        <aside className="live-list-side">
          <div className="group-tabs">
            {groups.map((g) => (
              <button key={g} className={g === group ? 'on' : ''} onClick={() => setGroup(g)}>
                {g}
              </button>
            ))}
          </div>
          <div className="channel-list">
            {visible.map((ch) => (
              <button
                key={ch.id}
                className={`channel ${selected?.id === ch.id ? 'on' : ''}`}
                onClick={() => void play(ch)}
              >
                <span className="channel-name">{ch.name}</span>
                <span className="channel-meta">{ch.urls.length > 1 ? `${ch.urls.length} 源` : '单源'}</span>
              </button>
            ))}
            {visible.length === 0 && channels && <Empty text="没有匹配的频道" />}
          </div>
        </aside>
      </div>
    </div>
  );
}
