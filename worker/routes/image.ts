import { getCachedResponse, hashKey, putCachedResponse } from '../cache';
import { error, fetchUpstream } from '../http';
import { checkUpstream } from '../ssrf';
import type { RouteContext } from '../types';

/** 封面代理：绕开盗链/混合内容限制，边缘缓存一天。 */
export async function proxyImage(ctx: RouteContext): Promise<Response> {
  const raw = ctx.url.searchParams.get('url') || '';
  const check = checkUpstream(raw);
  if (!check.ok) return error(check.error, 400);

  const key = await hashKey(`image:${raw}`);
  const hit = await getCachedResponse(key);
  if (hit) return hit;

  try {
    // 豆瓣图床：带防盗链需 Referer；且 Cloudflare 出口到它的 HTTPS 常报 525，
    // 改走 http 取图（对外仍是 https，无混合内容），再由本 Worker 缓存下发。
    const isDouban = /\.doubanio\.com$/i.test(new URL(raw).hostname);
    const target = isDouban ? raw.replace(/^https:\/\//i, 'http://') : raw;
    const headers = isDouban ? { Referer: 'https://movie.douban.com/' } : undefined;
    const upstream = await fetchUpstream(target, 8000, headers ? { headers } : undefined);
    if (!upstream.ok) return error(`图片源响应失败 (${upstream.status})`, 502);
    const type = upstream.headers.get('content-type') || 'image/jpeg';
    if (!/^image\//i.test(type)) return error('不是图片资源', 415);
    const res = new Response(upstream.body, {
      status: 200,
      headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=86400' },
    });
    void putCachedResponse(key, res.clone(), 86400);
    return res;
  } catch (e) {
    return error(e instanceof Error ? e.message : '图片获取失败', 502);
  }
}
