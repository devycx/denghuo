import { cachedJson } from '../cache';
import { cmsUrl, error, fetchUpstream, json, readJson } from '../http';
import { dedupeAndSort, parseDetail, parseVodList, relevance } from '../cms';
import { getConfig } from '../config';
import type { RouteContext, SearchItem, VideoDetail } from '../types';

interface SearchBody {
  wd?: string;
  sources?: string[];
  filterAdult?: boolean;
}

export async function search(ctx: RouteContext): Promise<Response> {
  const body = await readJson<SearchBody>(ctx.req);
  const wd = (body?.wd || '').trim();
  if (!wd || wd.length > 80) return error('搜索关键词无效', 400);

  const config = await getConfig(ctx.env);
  const filterAdult = body?.filterAdult !== false;
  let sources = config.sources.filter((s) =>
    Array.isArray(body?.sources) && body.sources.length > 0 ? body.sources.includes(s.key) : true
  );
  if (filterAdult) sources = sources.filter((s) => !s.isAdult);
  sources = sources.slice(0, 20);
  if (!sources.length) return json({ list: [], sourceCount: 0 });

  const results = await Promise.all(
    sources.map(async (source) => {
      try {
        return await cachedJson(`search:${source.key}`, wd, 180, async () => {
          const res = await fetchUpstream(cmsUrl(source.url, { ac: 'videolist', wd, pg: '1' }), 9000);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return parseVodList(await res.json(), source);
        });
      } catch {
        return [] as SearchItem[];
      }
    })
  );

  // 只展示列表接口已确认带可播地址的结果，避免点进去发现无法播放。
  const list = dedupeAndSort(results.flat(), wd)
    .filter((item) => item.playable !== false)
    .slice(0, 150);
  return json({ list, sourceCount: sources.length });
}

interface MultiBody {
  title?: string;
  year?: string;
  sources?: string[];
}

/** 换源：按片名在各源搜索最相近的一条并取详情，一次最多 8 个源（Workers 免费 subrequest 预算）。 */
export async function multiDetail(ctx: RouteContext): Promise<Response> {
  const body = await readJson<MultiBody>(ctx.req);
  const title = (body?.title || '').trim();
  if (!title) return error('缺少片名', 400);

  const config = await getConfig(ctx.env);
  const sources = config.sources
    .filter((s) => (Array.isArray(body?.sources) && body.sources.length ? body.sources.includes(s.key) : !s.isAdult))
    .slice(0, 8);

  const candidates = await Promise.all(
    sources.map(async (source) => {
      try {
        const list = await cachedJson(`search:${source.key}`, title, 180, async () => {
          const res = await fetchUpstream(cmsUrl(source.url, { ac: 'videolist', wd: title, pg: '1' }), 9000);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return parseVodList(await res.json(), source);
        });
        const best = list
          .filter((item) => item.playable !== false)
          .sort((a, b) => relevance(b.name, title) - relevance(a.name, title))[0];
        if (!best || relevance(best.name, title) < 40) return null;
        return await cachedJson(`detail:${source.key}`, best.vodId, 600, async () => {
          const res = await fetchUpstream(cmsUrl(source.url, { ac: 'detail', ids: best.vodId }), 9000);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return parseDetail(await res.json(), source);
        });
      } catch {
        return null;
      }
    })
  );

  const list = candidates.filter((item): item is VideoDetail => Boolean(item));
  return json({ list });
}
