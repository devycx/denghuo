import { useEffect, useState } from 'react';
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
  const [index, setIndex] = useState(0);
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
    if (slides.length < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % slides.length), 7000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const slide = slides[index % Math.max(1, slides.length)];
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

  return (
    <div className="page home">
      <section className="hero">
        <div className="hero-images" style={{ transform: `translateX(-${index * 100}%)` }}>
          {slides.map((s) => (
            <div className="hero-frame" key={s.key}>
              <img className="hero-backdrop" src={img(coverLarge(s.item.cover))} alt="" aria-hidden="true" />
            </div>
          ))}
          {!slides.length && <div className="hero-frame" />}
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
        {slides.length > 1 && (
          <div className="hero-dots" aria-label="头图轮播">
            {slides.map((s, i) => (
              <button
                key={s.key}
                className={i === index ? 'on' : ''}
                aria-label={`第 ${i + 1} 张：${s.item.title}`}
                onClick={() => setIndex(i)}
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
