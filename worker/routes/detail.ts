import { cachedJson } from '../cache';
import { cmsUrl, error, fetchUpstream, json } from '../http';
import { parseDetail } from '../cms';
import { getConfig } from '../config';
import type { RouteContext } from '../types';

export async function getDetail(ctx: RouteContext): Promise<Response> {
  const sourceKey = ctx.url.searchParams.get('source') || '';
  const id = ctx.url.searchParams.get('id') || '';
  if (!sourceKey) return error('缺少来源', 400);
  if (!/^[\w-]{1,64}$/.test(id)) return error('资源 ID 无效', 400);

  const config = await getConfig(ctx.env);
  const source = config.sources.find((s) => s.key === sourceKey);
  if (!source) return error('来源不存在', 404);

  try {
    const detail = await cachedJson(`detail:${source.key}`, id, 600, async () => {
      const res = await fetchUpstream(cmsUrl(source.url, { ac: 'detail', ids: id }), 9000);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return parseDetail(await res.json(), source);
    });
    return json(detail);
  } catch (e) {
    return error(e instanceof Error ? e.message : '获取详情失败', 502);
  }
}
