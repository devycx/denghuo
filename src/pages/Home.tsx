import { useEffect, useState } from 'react';
import { api, img } from '../api';
import { HotCard } from '../components/HotCard';
import { ErrorState, Loading } from '../components/States';
import { navigate } from '../router';
import type { DoubanHotItem } from '../types';

/** 豆瓣海报路径：s_ratio_poster / m_ratio_poster 换成 large 取高清大图做全幅背景。 */
function heroCover(cover: string): string {
  return cover.replace('s_ratio_poster', 'large').replace('m_ratio_poster', 'large');
}

export function Home() {
  const [tv, setTv] = useState<DoubanHotItem[] | null>(null);
  const [movies, setMovies] = useState<DoubanHotItem[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    Promise.all([api.douban('tv', 18), api.douban('movie', 18)])
      .then(([a, b]) => {
        if (!alive) return;
        setTv(a.items);
        setMovies(b.items);
      })
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  const hero = tv?.[0];
  const openHero = () => {
    if (hero) navigate(`/search?q=${encodeURIComponent(hero.title)}`);
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
                <button className="btn primary" onClick={openHero}>▶ 立即搜索</button>
                <button className="btn secondary" onClick={openHero}>更多信息</button>
              </div>
            </>
          ) : (
            <p className="hero-kicker">{error || '加载中…'}</p>
          )}
        </div>
      </section>

      {error && <ErrorState message={error} onRetry={() => window.location.reload()} />}
      {!tv && !error && <Loading />}
      {tv && movies && (
        <div className="home-rails">
          <section className="row-section">
            <div className="row-heading"><h2>最近热门 · 剧集</h2></div>
            <div className="card-row">{tv.map((item) => <HotCard key={item.id} item={item} />)}</div>
          </section>
          <section className="row-section">
            <div className="row-heading"><h2>最近热门 · 电影</h2></div>
            <div className="card-row">{movies.map((item) => <HotCard key={item.id} item={item} />)}</div>
          </section>
        </div>
      )}
    </div>
  );
}
