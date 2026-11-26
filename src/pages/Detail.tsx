import { useEffect, useState } from 'react';
import { api, img } from '../api';
import { ErrorState, Loading } from '../components/States';
import { toast } from '../components/Toast';
import { navigate, useRoute } from '../router';
import { entryKey, useStore } from '../store';
import type { VideoDetail } from '../types';

export function Detail() {
  const route = useRoute();
  const source = route.params.get('source') || '';
  const id = route.params.get('id') || '';
  const { toggleFavorite, isFavorite } = useStore();
  const [detail, setDetail] = useState<VideoDetail | null>(null);
  const [error, setError] = useState('');
  const [lineIndex, setLineIndex] = useState(0);
  const [candidates, setCandidates] = useState<VideoDetail[] | null>(null);
  const [showSources, setShowSources] = useState(false);

  useEffect(() => {
    let alive = true;
    setDetail(null);
    setError('');
    setLineIndex(0);
    setCandidates(null);
    setShowSources(false);
    api
      .detail(source, id)
      .then((d) => alive && setDetail(d))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [source, id]);

  const openSources = async () => {
    if (!detail) return;
    setShowSources(true);
    setCandidates(null);
    try {
      const res = await api.multiDetail(detail.title);
      setCandidates(res.list);
    } catch (e) {
      toast(e instanceof Error ? e.message : '换源失败');
    }
  };

  if (error) return <div className="page"><ErrorState message={error} onRetry={() => window.location.reload()} /></div>;
  if (!detail) return <div className="page"><Loading text="正在整理剧集……" /></div>;

  const key = entryKey(detail.sourceKey, detail.vodId);
  const favorite = isFavorite(key);
  const line = detail.lines[lineIndex];

  return (
    <div className="page detail-page">
      <button className="back-link" onClick={() => window.history.back()}>
        ← 返回
      </button>
      <div className="detail-head">
        <div className="detail-cover">
          {detail.cover ? <img src={img(detail.cover)} alt={detail.title} /> : <div className="detail-placeholder">灯</div>}
        </div>
        <div className="detail-info">
          <h1>{detail.title}</h1>
          <div className="tag-row">
            {detail.year && <span className="tag">{detail.year}</span>}
            {detail.typeName && <span className="tag">{detail.typeName}</span>}
            {detail.area && <span className="tag">{detail.area}</span>}
            <span className="tag soft">{detail.sourceName}</span>
          </div>
          {detail.desc && <p className="desc">{detail.desc}</p>}
          <div className="detail-actions">
            {line?.episodes[0] && (
              <button
                className="btn primary"
                onClick={() => navigate(`/watch?source=${detail.sourceKey}&id=${detail.vodId}&line=${lineIndex}&ep=0`)}
              >
                ▶ 立即播放
              </button>
            )}
            <button
              className="btn"
              onClick={() => {
                toggleFavorite({ key, sourceKey: detail.sourceKey, vodId: detail.vodId, title: detail.title, pic: detail.cover });
                toast(favorite ? '已取消收藏' : '已加入收藏');
              }}
            >
              {favorite ? '★ 已收藏' : '☆ 收藏'}
            </button>
            <button className="btn" onClick={openSources}>
              ⇄ 换源
            </button>
          </div>
        </div>
      </div>

      {detail.lines.length > 0 && (
        <section className="episodes-section">
          <div className="section-head">
            <h2>选集</h2>
            <div className="line-tabs">
              {detail.lines.map((l, i) => (
                <button key={`${l.name}-${i}`} className={i === lineIndex ? 'on' : ''} onClick={() => setLineIndex(i)}>
                  {l.name}
                </button>
              ))}
            </div>
          </div>
          {line && line.episodes.length > 0 ? (
            <div className="episode-grid">
              {line.episodes.map((ep, i) => (
                <button
                  key={`${ep.name}-${i}`}
                  onClick={() => navigate(`/watch?source=${detail.sourceKey}&id=${detail.vodId}&line=${lineIndex}&ep=${i}`)}
                  title={ep.url}
                >
                  {ep.name || `第 ${i + 1} 集`}
                </button>
              ))}
            </div>
          ) : (
            <p className="muted">该线路暂无可用分集，试试「换源」。</p>
          )}
        </section>
      )}

      {showSources && (
        <div className="modal-backdrop" onClick={() => setShowSources(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>其它资源源</h2>
              <button className="icon-btn" onClick={() => setShowSources(false)}>✕</button>
            </div>
            {!candidates && <Loading text="正在其它源里找同一部……" />}
            {candidates?.length === 0 && <p className="muted">暂时没有找到其它可用来源。</p>}
            {candidates?.map((item) => (
              <button
                className="source-candidate"
                key={`${item.sourceKey}:${item.vodId}`}
                onClick={() => navigate(`/detail?source=${item.sourceKey}&id=${item.vodId}`)}
              >
                <span className="source-name">{item.sourceName}</span>
                <span className="muted">{item.lines.reduce((sum, l) => sum + l.episodes.length, 0)} 集</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
