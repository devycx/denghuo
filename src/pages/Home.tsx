import { useEffect, useRef, useState } from 'react';
import { api, img } from '../api';
import { HotCard } from '../components/HotCard';
import { ErrorState } from '../components/States';
import { navigate } from '../router';
import type { DoubanHotItem } from '../types';

const CACHE_KEY = 'denghuo:home-v1';
const CACHE_TTL = 60 * 60 * 1000;

const ROWS = [
  { key: 'tv-hot', title: '最近热门 · 剧集', type: 'tv' as const, tag: '热门' },
  { key: 'movie-hot', title: '最近热门 · 电影', type: 'movie' as const, tag: '热门' },
  { key: 'show-hot', title: '热播综艺', type: 'tv' as const, tag: '综艺' },
  { key: 'tv-cn', title: '国产好剧', type: 'tv' as const, tag: '国产剧' },
  { key: 'movie-classic', title: '经典电影', type: 'movie' as const, tag: '经典' },
];

type Rows = Record<string, DoubanHotItem[]>;
type PlayRef = { source: string; id: string };

function readCache(): Rows {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { at?: number; rows?: Rows };
    if (!parsed.at || Date.now() - parsed.at > CACHE_TTL || !parsed.rows) return {};
    return parsed.rows;
  } catch {
    return {};
  }
}

/** 豆瓣公开图床的最高分辨率是 large（原始约 1000px+）；raw 路径已 404。 */
function coverLarge(cover: string): string {
  return cover.replace('s_ratio_poster', 'large').replace('m_ratio_poster', 'large');
}

function SkeletonRow({ title }: { title: string }) {
  return (
    <section className="row-section">
      <div className="row-heading"><h2>{title}</h2></div>
      <div className="card-row">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton-card" aria-hidden="true" />)}
      </div>
    </section>
  );
}

export function Home() {
  const [rows, setRows] = useState<Rows>(readCache);
  const [error, setError] = useState('');
  // 轨道 = [末张克隆, 三张真实, 首张克隆]；pos 落在 1..3 是真实帧，0 / 4 是过渡帧。
  const [pos, setPos] = useState(1);
  const [animating, setAnimating] = useState(true);
  const [dragX, setDragX] = useState(0);
  const [width, setWidth] = useState(() => (typeof window === 'undefined' ? 0 : window.innerWidth));
  const heroRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{ startX: number; dx: number } | null>(null);
  // 用定时器归位，不依赖 transitionend：系统开启「减弱动效」时过渡接近 0ms，事件会立刻到达。
  const snapTimerRef = useRef<number | null>(null);
  const posRef = useRef(pos);
  posRef.current = pos;
  const [playMap, setPlayMap] = useState<Record<string, PlayRef>>({});

  useEffect(() => {
    let alive = true;
    Promise.all(
      ROWS.map(async (row) => {
        try {
          const res = await api.douban(row.type, row.tag, 18);
          return [row.key, res.items] as const;
        } catch {
          return [row.key, [] as DoubanHotItem[]] as const;
        }
      })
    ).then((entries) => {
      if (!alive) return;
      const next = Object.fromEntries(entries) as Rows;
      if (!Object.values(next).some((items) => items.length > 0)) {
        setError('热门内容暂时不可用');
        return;
      }
      setRows(next);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), rows: next }));
      } catch {
        /* 隐私模式忽略 */
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const slides = [
    rows['tv-hot']?.[0] && { key: 'tv-hot', label: '最近热门 · 剧集', item: rows['tv-hot'][0] },
    rows['movie-hot']?.[0] && { key: 'movie-hot', label: '最近热门 · 电影', item: rows['movie-hot'][0] },
    rows['show-hot']?.[0] && { key: 'show-hot', label: '热播综艺', item: rows['show-hot'][0] },
  ].filter(Boolean) as { key: string; label: string; item: DoubanHotItem }[];

  const count = slides.length;
  // 首尾克隆帧让「第三张 → 第一张」继续向同一方向滑，不会倒着退回去。
  const frames = count ? [slides[count - 1], ...slides, slides[0]] : [];
  const realIndex = count ? ((pos - 1) % count + count) % count : 0;
  const slide = slides[realIndex];

  useEffect(() => () => cancelSnap(), []);
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 头图一出现就把三张主推的播放源提前备好，点按钮直接进播放页。
  const slideKeys = slides.map((s) => `${s.key}:${s.item.title}`).join('|');
  useEffect(() => {
    if (!slideKeys) return;
    let alive = true;
    for (const slide of slides) {
      api
        .resolve(slide.item.title)
        .then((res) => {
          if (alive) setPlayMap((prev) => ({ ...prev, [slide.key]: { source: res.sourceKey, id: res.vodId } }));
        })
        .catch(() => {});
    }
    return () => {
      alive = false;
    };
  }, [slideKeys]);

  useEffect(() => {
    if (count < 2) return;
    const timer = setInterval(() => {
      if (dragRef.current) return;
      moveBy(1);
    }, 7000);
    return () => clearInterval(timer);
  }, [count]);

  const cancelSnap = () => {
    if (snapTimerRef.current !== null) {
      clearTimeout(snapTimerRef.current);
      snapTimerRef.current = null;
    }
  };
  // 滑到克隆帧后瞬间跳回对应的真实帧：位置变了但画面一样，所以看不出跳变。
  const snapTo = (to: number) => {
    cancelSnap();
    setAnimating(false);
    setPos(to);
    requestAnimationFrame(() => requestAnimationFrame(() => setAnimating(true)));
  };
  // 每次移动后都校验位置：只要 pos 落在真实帧之外就归位。
  // 不能只在「刚到克隆帧」时安排归位——连续快滑会取消那次定时器，之后 pos 会一路累加滑出画面。
  const scheduleSnap = () => {
    cancelSnap();
    snapTimerRef.current = window.setTimeout(() => {
      snapTimerRef.current = null;
      if (dragRef.current) {
        scheduleSnap();
        return;
      }
      const p = posRef.current;
      const target = ((p - 1) % count + count) % count + 1;
      if (target !== p) snapTo(target);
    }, 950);
  };

  // 连续快滑时先归位再走下一步：克隆帧和真实帧画面相同，归一瞬间看不出来。
  // 分两帧提交，避免与紧随的移动合并成一次渲染而出现跳帧。
  const moveBy = (dir: number) => {
    const p = posRef.current;
    if (count < 2 || dir === 0) return;
    if (p < 1 || p > count) {
      const target = ((p - 1) % count + count) % count + 1;
      cancelSnap();
      setAnimating(false);
      setPos(target);
      posRef.current = target;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        setAnimating(true);
        const next = posRef.current + dir;
        posRef.current = next;
        setPos(next);
        scheduleSnap();
      }));
      return;
    }
    setAnimating(true);
    const next = p + dir;
    posRef.current = next;
    setPos(next);
    scheduleSnap();
  };

  const play = async () => {
    if (!slide) return;
    const ready = playMap[slide.key];
    if (ready) {
      navigate(`/watch?source=${encodeURIComponent(ready.source)}&id=${encodeURIComponent(ready.id)}`);
      return;
    }
    try {
      const res = await api.resolve(slide.item.title);
      navigate(`/watch?source=${encodeURIComponent(res.sourceKey)}&id=${encodeURIComponent(res.vodId)}`);
    } catch {
      navigate(`/search?q=${encodeURIComponent(slide.item.title)}`);
    }
  };

  const goTo = (i: number) => {
    if (count < 2) return;
    const p = posRef.current;
    const current = ((p - 1) % count + count) % count;
    let delta = i - current;
    if (delta > count / 2) delta -= count;
    if (delta < -count / 2) delta += count;
    moveBy(delta);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (count < 2 || (e.target as HTMLElement).closest('button, a')) return;
    dragRef.current = { startX: e.clientX, dx: 0 };
    setAnimating(false);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    dragRef.current.dx = dx;
    setDragX(dx);
  };
  const onPointerUp = () => {
    const dx = dragRef.current?.dx || 0;
    dragRef.current = null;
    setDragX(0);
    setAnimating(true);
    if (dx < -40 || dx > 40) moveBy(dx < -40 ? 1 : -1);
  };

  return (
    <div className="page home">
      <section
        className="hero"
        ref={heroRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className={`hero-images ${dragRef.current ? 'dragging' : ''}`}
          style={{
            transform: `translateX(${-pos * width + dragX}px)`,
            transition: animating ? undefined : 'none',
          }}
        >
          {frames.map((s, i) => (
            <div className="hero-frame" key={`${s.key}-${i}`}>
              <img className="hero-backdrop" src={img(coverLarge(s.item.cover))} alt="" aria-hidden="true" />
            </div>
          ))}
          {!count && <div className="hero-frame" />}
        </div>
        <div className="hero-content">
          {slide ? (
            <>
              <p className="hero-kicker">{slide.label}</p>
              <h1>{slide.item.title}</h1>
              {slide.item.rating && <p className="hero-rating">{slide.item.rating}</p>}
              <div className="hero-actions">
                <button className="btn primary" onClick={play}>▶ 立即播放</button>
              </div>
            </>
          ) : (
            <div className="hero-skeleton"><span /><span /><span /></div>
          )}
        </div>
        {count > 1 && (
          <div className="hero-dots" aria-label="头图轮播">
            {slides.map((s, i) => (
              <button
                key={s.key}
                className={i === realIndex ? 'on' : ''}
                aria-label={`第 ${i + 1} 张：${s.item.title}`}
                onClick={() => goTo(i)}
              />
            ))}
          </div>
        )}
      </section>

      {error && <ErrorState message={error} onRetry={() => window.location.reload()} />}
      <div className="home-rails">
        {ROWS.map((row) =>
          rows[row.key]?.length ? (
            <section className="row-section" key={row.key}>
              <div className="row-heading"><h2>{row.title}</h2></div>
              <div className="card-row">
                {rows[row.key].map((item, i) => (
                  <HotCard key={item.id} item={item} large={i < 3} />
                ))}
              </div>
            </section>
          ) : (
            <SkeletonRow key={row.key} title={row.title} />
          )
        )}
      </div>
    </div>
  );
}
