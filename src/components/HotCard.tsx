import { useEffect, useRef, useState } from 'react';
import { api, img } from '../api';
import { navigate } from '../router';
import type { DoubanHotItem } from '../types';
import { toast } from './Toast';

type PlayRef = { source: string; id: string };

/** 豆瓣热门条目：进入视口即预解析可播资源，点击直接进播放页。 */
export function HotCard({ item, large = false }: { item: DoubanHotItem; large?: boolean }) {
  const ref = useRef<HTMLElement | null>(null);
  const playRef = useRef<PlayRef | null>(null);
  const [busy, setBusy] = useState(false);
  const cover = large
    ? item.cover.replace('s_ratio_poster', 'large').replace('m_ratio_poster', 'large')
    : item.cover;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let alive = true;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting) || playRef.current) return;
        observer.disconnect();
        api
          .resolve(item.title)
          .then((res) => {
            if (alive) playRef.current = { source: res.sourceKey, id: res.vodId };
          })
          .catch(() => {});
      },
      { rootMargin: '300px' }
    );
    observer.observe(node);
    return () => {
      alive = false;
      observer.disconnect();
    };
  }, [item.title]);

  const open = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await api.resolve(item.title);
      const found: PlayRef = playRef.current || { source: res.sourceKey, id: res.vodId };
      playRef.current = found;
      navigate(`/watch?source=${encodeURIComponent(found.source)}&id=${encodeURIComponent(found.id)}`);
    } catch {
      toast('暂未找到可播资源');
    } finally {
      setBusy(false);
    }
  };

  return (
    <article
      ref={ref}
      className="card"
      onClick={open}
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && open()}
      aria-label={`${item.title}，立即播放`}
    >
      <div className="card-poster">
        <img src={img(cover)} alt={item.title} loading="lazy" />
        {item.rating && <span className="card-badge">{item.rating}</span>}
      </div>
      <div className="card-meta">
        <h3 title={item.title}>{item.title}</h3>
        <p><span className="muted">豆瓣热门</span></p>
      </div>
    </article>
  );
}
