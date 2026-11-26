import { cachedJson } from '../cache';
import { getConfig } from '../config';
import { cmsUrl, fetchUpstream, json } from '../http';
import { parseVodList } from '../cms';
import type { RouteContext } from '../types';

export async function getSiteConfig(ctx: RouteContext): Promise<Response> {
  return json(await getConfig(ctx.env));
}

export async function getHealth(): Promise<Response> {
  return json({ ok: true, service: 'denghuo', time: Date.now() });
}

/** 首页推荐行：每个源取第一页最新，缓存 10 分钟；Cron 也会来预热。 */
export async function getHome(ctx: RouteContext): Promise<Response> {
  const config = await getConfig(ctx.env);
  const sources = config.sources.filter((s) => !s.isAdult).slice(0, 6);
  const rows = await Promise.all(
    sources.map(async (source) => {
      try {
        const items = await cachedJson(`home:${source.key}`, source.url, 600, async () => {
          const res = await fetchUpstream(cmsUrl(source.url, { ac: 'videolist', pg: '1' }), 8000);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return parseVodList(await res.json(), source);
        });
        return { sourceKey: source.key, sourceName: source.name, items: items.slice(0, 18) };
      } catch {
        return { sourceKey: source.key, sourceName: source.name, items: [] };
      }
    })
  );
  return json({ rows: rows.filter((row) => row.items.length > 0) });
}
