import type { HomeRow } from '../types';
import { VideoCard } from './VideoCard';

export function VideoRow({ row }: { row: HomeRow }) {
  return (
    <section className="row-section">
      <div className="row-heading">
        <h2>{row.sourceName}</h2>
        <span className="muted">最新收录</span>
      </div>
      <div className="card-row">
        {row.items.map((item) => (
          <VideoCard key={`${item.sourceKey}:${item.vodId}`} item={item} />
        ))}
      </div>
    </section>
  );
}
