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
    const origin = new URL(raw);
    const isDouban = /\.doubanio\.com$/i.test(origin.hostname);
    const headers = isDouban ? { Referer: 'https://movie.douban.com/' } : undefined;
    // 豆瓣单台图床偶发 403/404，按 img1/2/3/9 轮换重试。
    const hosts = isDouban
      ? ['img1.doubanio.com', 'img2.doubanio.com', 'img3.doubanio.com', 'img9.doubanio.com']
      : [origin.host];
    let upstream: Response | null = null;
    for (const host of hosts) {
      const u = new URL(raw);
      u.host = host;
      if (isDouban) u.protocol = 'http:';
      try {
        const candidate = await fetchUpstream(u.toString(), 8000, headers ? { headers } : undefined);
        if (candidate.ok && /^image\//i.test(candidate.headers.get('content-type') || '')) {
          upstream = candidate;
          break;
        }
      } catch {
        /* 换下一台图床 */
      }
    }
    if (!upstream) return error('图片源响应失败', 502);
    const type = upstream.headers.get('content-type') || 'image/jpeg';
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
