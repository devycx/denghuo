import { cachedJson } from '../cache';
import { relevance, parseVodList } from '../cms';
import { getConfig } from '../config';
import { cmsUrl, error, fetchUpstream, json } from '../http';
import type { RouteContext, SearchItem } from '../types';

/**
 * 片名 → 一条确实可播的资源。列表接口自带 vod_play_url，
 * 无需再请求详情即可判断可播，响应缓存 5 分钟。
 */
export async function resolvePlayable(ctx: RouteContext): Promise<Response> {
  const title = (ctx.url.searchParams.get('title') || '').trim();
  if (!title || title.length > 80) return error('片名无效', 400);

  const config = await getConfig(ctx.env);
  const sources = config.sources.filter((s) => !s.isAdult).slice(0, 12);
  if (!sources.length) return error('暂无可用资源源', 404);

  const results = await Promise.all(
    sources.map(async (source) => {
      try {
        return await cachedJson(`resolve:${source.key}`, title, 300, async () => {
          const res = await fetchUpstream(cmsUrl(source.url, { ac: 'videolist', wd: title, pg: '1' }), 9000);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return parseVodList(await res.json(), source).filter((item) => item.playable !== false);
        });
      } catch {
        return [] as SearchItem[];
      }
    })
  );

  const best = results
    .flat()
    .sort((a, b) => relevance(b.name, title) - relevance(a.name, title))[0];
  if (!best) return error('未找到可播资源', 404);
  return json({ sourceKey: best.sourceKey, vodId: best.vodId, title: best.name });
}
