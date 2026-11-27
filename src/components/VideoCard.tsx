import { img } from '../api';
import { navigate } from '../router';
import { entryKey, useStore } from '../store';
import type { SearchItem } from '../types';
import { toast } from './Toast';

interface Props {
  item: SearchItem;
}

export function VideoCard({ item }: Props) {
  const { toggleFavorite, isFavorite } = useStore();
  const key = entryKey(item.sourceKey, item.vodId);
  const favorite = isFavorite(key);

  const open = () => navigate(`/detail?source=${encodeURIComponent(item.sourceKey)}&id=${encodeURIComponent(item.vodId)}`);

  return (
    <article className="card" onClick={open} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && open()}>
      <div className="card-poster">
        {item.pic ? <img src={img(item.pic)} alt={item.name} loading="lazy" /> : <div className="card-placeholder" aria-hidden="true" />}
        {item.remarks && <span className="card-badge">{item.remarks}</span>}
        {Boolean(item.altCount) && <span className="card-alt">{(item.altCount || 0) + 1} 源</span>}
        <button
          className={`card-fav ${favorite ? 'on' : ''}`}
          aria-label={favorite ? '取消收藏' : '收藏'}
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite({
              key,
              sourceKey: item.sourceKey,
              vodId: item.vodId,
              title: item.name,
              pic: item.pic,
            });
            toast(favorite ? '已取消收藏' : '已加入收藏');
          }}
        >
          {favorite ? '✓' : '+'}
        </button>
      </div>
      <div className="card-meta">
        <h3 title={item.name}>{item.name}</h3>
        <p>
          {item.year && <span>{item.year}</span>}
          {item.typeName && <span>{item.typeName}</span>}
          <span className="muted">{item.sourceName}</span>
        </p>
      </div>
    </article>
  );
}
