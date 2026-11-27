import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { Player } from '../components/Player';
import { ErrorState, Loading } from '../components/States';
import { navigate, useRoute } from '../router';
import { entryKey, useStore } from '../store';
import type { VideoDetail } from '../types';

const unique = (urls: (string | undefined)[]): string[] =>
  urls.filter((u, i, all): u is string => Boolean(u) && all.indexOf(u) === i);

export function Watch() {
  const route = useRoute();
  const source = route.params.get('source') || '';
  const id = route.params.get('id') || '';
  const epIndex = Math.max(0, Number(route.params.get('ep') || 0) || 0);
  const lineIndex = Math.max(0, Number(route.params.get('line') || 0) || 0);
  const { settings, saveHistory } = useStore();
  const [detail, setDetail] = useState<VideoDetail | null>(null);
  const [error, setError] = useState('');
  const [fallbacks, setFallbacks] = useState<string[]>([]);
  const progressRef = useRef(0);

  useEffect(() => {
    let alive = true;
    setDetail(null);
    setError('');
    api
      .detail(source, id)
      .then((d) => alive && setDetail(d))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [source, id]);

  // 备用线路：先排当前详情的其它线路（立即可用），再在后台向其它源找同一集。
  // 只保留地址，不展示来源名；播放失败时播放器会按顺序快速尝试。
  useEffect(() => {
    setFallbacks([]);
    if (!detail) return;
    let alive = true;
    const local = detail.lines
      .filter((_, i) => i !== lineIndex)
      .map((l) => l.episodes[epIndex]?.url);
    setFallbacks(unique(local));

    api
      .multiDetail(detail.title)
      .then((res) => {
        if (!alive) return;
        const remote = res.list.flatMap((d) =>
          d.lines.map((l) => l.episodes[Math.min(epIndex, l.episodes.length - 1)]?.url)
        );
        setFallbacks((prev) => unique([...prev, ...remote]));
      })
      .catch(() => {
        /* 其它源不可用时仍可尝试当前详情的线路 */
      });
    return () => {
      alive = false;
    };
  }, [detail, lineIndex, epIndex]);

  const episode = detail?.lines[lineIndex]?.episodes[epIndex];
  const total = detail?.lines[lineIndex]?.episodes.length || 0;

  useEffect(() => {
    progressRef.current = 0;
    if (!detail || !episode) return;
    saveHistory({
      key: entryKey(detail.sourceKey, detail.vodId),
      sourceKey: detail.sourceKey,
      vodId: detail.vodId,
      title: detail.title,
      pic: detail.cover,
      epIndex,
      epName: episode.name,
      progress: 0,
    });
  }, [detail, episode, epIndex]);

  const goto = (next: number) => {
    if (next < 0 || next >= total) return;
    navigate(`/watch?source=${source}&id=${id}&line=${lineIndex}&ep=${next}`);
  };

  if (error) return <div className="page"><ErrorState message={error} onRetry={() => window.location.reload()} /></div>;
  if (!detail) return <div className="page"><Loading text="正在准备播放……" /></div>;

  const persist = (seconds: number) => {
    progressRef.current = seconds;
    if (!episode) return;
    saveHistory({
      key: entryKey(detail.sourceKey, detail.vodId),
      sourceKey: detail.sourceKey,
      vodId: detail.vodId,
      title: detail.title,
      pic: detail.cover,
      epIndex,
      epName: episode.name,
      progress: seconds,
    });
  };

  return (
    <div className="page watch-page">
      <div className="watch-top">
        <button className="back-link" onClick={() => navigate(`/detail?source=${source}&id=${id}`)}>
          详情
        </button>
        <h1>
          {detail.title} <span className="muted">{episode?.name}</span>
        </h1>
      </div>

      <div className="watch-layout">
        <div className="watch-main">
          {episode ? (
            <Player
              url={episode.url}
              fallbackUrls={fallbacks.filter((u) => u !== episode.url)}
              poster={detail.cover}
              title={`${detail.title} · ${episode.name}`}
              seekTo={progressRef.current}
              onProgress={persist}
              onEnded={() => settings.autoplay && epIndex + 1 < total && goto(epIndex + 1)}
              onPrev={() => goto(epIndex - 1)}
              onNext={() => goto(epIndex + 1)}
            />
          ) : (
            <div className="state">该线路没有可播放的分集，请回详情页重试。</div>
          )}

          <div className="watch-controls">
            <button className="btn" disabled={epIndex === 0} onClick={() => goto(epIndex - 1)}>
              上一集
            </button>
            <span className="muted">
              {epIndex + 1} / {total}
            </span>
            <button className="btn" disabled={epIndex + 1 >= total} onClick={() => goto(epIndex + 1)}>
              下一集
            </button>
          </div>
        </div>

        <aside className="watch-side">
          <h3>播放列表</h3>
          <div className="watch-episodes">
            {detail.lines[lineIndex]?.episodes.map((ep, i) => (
              <button key={`${ep.name}-${i}`} className={i === epIndex ? 'on' : ''} onClick={() => goto(i)}>
                {ep.name || `第 ${i + 1} 集`}
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
