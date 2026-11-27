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
  { key: 'tv-cn', title: '国产好剧', type: 'tv' as const, tag: '国产剧' },
  { key: 'movie-classic', title: '经典电影', type: 'movie' as const, tag: '经典' },
];

type Rows = Record<string, DoubanHotItem[]>;

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

/** 豆瓣海报路径：s_ratio_poster / m_ratio_poster 换成 large 取高清大图做全幅背景。 */
function heroCover(cover: string): string {
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
  const [heroPlay, setHeroPlay] = useState<{ source: string; id: string } | null>(null);

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
      const filled = Object.values(next).some((items) => items.length > 0);
      if (!filled) {
        setError('热门内容暂时不可用');
        return;
      }
      setRows(next);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), rows: next }));
      } catch {
        /* 隐私模式下忽略 */
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const hero = rows['tv-hot']?.[0];
  const heroTitle = hero?.title;

  // 头图一出现就提前把可播放的源/片 ID 备好，按钮点下去直接进播放页。
  useEffect(() => {
    if (!heroTitle) return;
    let alive = true;
    setHeroPlay(null);
    api
      .multiDetail(heroTitle)
      .then((res) => {
        const match = res.list.find((d) => d.lines?.some((line) => line.episodes.length > 0));
        if (alive && match) setHeroPlay({ source: match.sourceKey, id: match.vodId });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [heroTitle]);

  const play = async () => {
    if (!heroTitle) return;
    if (heroPlay) {
      navigate(`/watch?source=${encodeURIComponent(heroPlay.source)}&id=${encodeURIComponent(heroPlay.id)}`);
      return;
    }
    try {
      const res = await api.multiDetail(heroTitle);
      const match = res.list.find((d) => d.lines?.some((line) => line.episodes.length > 0));
      if (match) navigate(`/watch?source=${encodeURIComponent(match.sourceKey)}&id=${encodeURIComponent(match.vodId)}`);
    } catch {
      navigate(`/search?q=${encodeURIComponent(heroTitle)}`);
    }
  };

  return (
    <div className="page home">
      <section className="hero">
        {hero && <img className="hero-backdrop" src={img(heroCover(hero.cover))} alt="" aria-hidden="true" />}
        <div className="hero-shade" aria-hidden="true" />
        <div className="hero-content">
          {hero ? (
            <>
              <p className="hero-kicker">最近热门 · 剧集</p>
              <h1>{hero.title}</h1>
              {hero.rating && <p className="hero-rating">{hero.rating}</p>}
              <div className="hero-actions">
                <button className="btn primary" onClick={play}>▶ 立即播放</button>
              </div>
            </>
          ) : (
            <div className="hero-skeleton"><span /><span /><span /></div>
          )}
        </div>
      </section>

      {error && <ErrorState message={error} onRetry={() => window.location.reload()} />}
      <div className="home-rails">
        {ROWS.map((row) =>
          rows[row.key]?.length ? (
            <section className="row-section" key={row.key}>
              <div className="row-heading"><h2>{row.title}</h2></div>
              <div className="card-row">
                {rows[row.key].map((item) => <HotCard key={item.id} item={item} />)}
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
