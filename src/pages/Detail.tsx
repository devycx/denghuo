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

  useEffect(() => {
    let alive = true;
    setDetail(null);
    setError('');
    setLineIndex(0);
    api
      .detail(source, id)
      .then((d) => alive && setDetail(d))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [source, id]);

  if (error) return <div className="page"><ErrorState message={error} onRetry={() => window.location.reload()} /></div>;
  if (!detail) return <div className="page"><Loading text="正在整理剧集……" /></div>;

  const key = entryKey(detail.sourceKey, detail.vodId);
  const favorite = isFavorite(key);
  const line = detail.lines[lineIndex];

  return (
    <div className="page detail-page">
      <button className="back-link" onClick={() => window.history.back()}>
        返回
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
          </div>
          {detail.desc && <p className="desc">{detail.desc}</p>}
          <div className="detail-actions">
            {line?.episodes[0] && (
              <button
                className="btn primary"
                onClick={() => navigate(`/watch?source=${detail.sourceKey}&id=${detail.vodId}&line=${lineIndex}&ep=0`)}
              >
                立即播放
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
          </div>
        </div>
      </div>

      {detail.lines.length > 0 && (
        <section className="episodes-section">
          <div className="section-head">
            <h2>选集</h2>
            {/* 源信息不暴露给用户：播放失败时会自动依次尝试下一个源。 */}
            {detail.lines.length > 1 && (
              <div className="line-tabs">
                {detail.lines.map((_, i) => (
                  <button key={i} className={i === lineIndex ? 'on' : ''} onClick={() => setLineIndex(i)}>
                    线路 {i + 1}
                  </button>
                ))}
              </div>
            )}
          </div>
          {line && line.episodes.length > 0 ? (
            <div className="episode-grid">
              {line.episodes.map((ep, i) => (
                <button
                  key={`${ep.name}-${i}`}
                  onClick={() => navigate(`/watch?source=${detail.sourceKey}&id=${detail.vodId}&line=${lineIndex}&ep=${i}`)}
                >
                  {ep.name || `第 ${i + 1} 集`}
                </button>
              ))}
            </div>
          ) : (
            <p className="muted">该线路暂无可用分集，请返回重试。</p>
          )}
        </section>
      )}
    </div>
  );
}
