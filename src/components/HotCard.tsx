import { img } from '../api';
import { navigate } from '../router';
import type { DoubanHotItem } from '../types';

/** 豆瓣热门条目：点击后在本站源里按片名搜索，不伪造 source/vodId。 */
export function HotCard({ item }: { item: DoubanHotItem }) {
  const open = () => navigate(`/search?q=${encodeURIComponent(item.title)}`);
  return (
    <article className="card" onClick={open} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && open()}>
      <div className="card-poster">
        <img src={img(item.cover)} alt={item.title} loading="lazy" />
        {item.rating && <span className="card-badge">{item.rating}</span>}
      </div>
      <div className="card-meta">
        <h3 title={item.title}>{item.title}</h3>
        <p><span className="muted">豆瓣热门</span></p>
      </div>
    </article>
  );
}
