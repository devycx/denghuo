import { useEffect, useState } from 'react';
import { api, img } from '../api';
import { ErrorState, Loading } from '../components/States';
import { VideoRow } from '../components/VideoRow';
import { navigate } from '../router';
import { useStore } from '../store';
import type { HomeRow } from '../types';

export function Home() {
  const { config } = useStore();
  const [rows, setRows] = useState<HomeRow[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    api.home().then((res) => alive && setRows(res.rows)).catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  const hero = rows?.[0]?.items[0];

  return (
    <div className="page home">
      <section className="hero">
        <div className="hero-glow" />
        <div className="hero-copy">
          <span className="eyebrow">灯火视频 · 一点即播</span>
          <h1>
            好内容，<em>一盏灯</em>就够
          </h1>
          <p>聚合多源、自动去重、边缘加速。不 tracking、不弹窗、不绑架你的浏览器。</p>
          <div className="hero-actions">
            <button className="btn primary" onClick={() => document.querySelector<HTMLInputElement>('.searchbar input')?.focus()}>
              开始搜索
            </button>
            <a className="btn ghost" href="#/live">
              看电视直播
            </a>
          </div>
        </div>
        {hero && (
          <button className="hero-card" onClick={() => navigate(`/detail?source=${hero.sourceKey}&id=${hero.vodId}`)}>
            <img src={img(hero.pic)} alt="" />
            <span>{hero.name}</span>
          </button>
        )}
      </section>

      {error && <ErrorState message={error} onRetry={() => window.location.reload()} />}
      {!rows && !error && <Loading />}
      {rows?.length === 0 && (
        <div className="state">
          <p>还没有可用的内容源。去设置里添加，或用管理接口导入。</p>
          <a className="btn" href="#/settings">
            打开设置
          </a>
        </div>
      )}
      {rows?.map((row) => <VideoRow key={row.sourceKey} row={row} />)}

      <section className="feature-strip">
        <div><strong>Cloudflare Workers</strong><span>边缘计算，全球加速</span></div>
        <div><strong>Cache API</strong><span>搜索与封面缓存，秒开</span></div>
        <div><strong>Workers KV</strong><span>源配置在线可改</span></div>
        <div><strong>MIT 许可</strong><span>代码完全自主可控</span></div>
      </section>
      <p className="footer-note">{config?.siteName || '灯火视频'} · 本站点仅提供聚合检索与播放能力，不存储任何影片。</p>
    </div>
  );
}
