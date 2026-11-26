import { cachedJson } from '../cache';
import { getConfig } from '../config';
import { error, fetchUpstream, json } from '../http';
import { mergeChannels, parseM3u } from '../live';
import { checkUpstream } from '../ssrf';
import type { RouteContext } from '../types';

export async function getChannels(ctx: RouteContext): Promise<Response> {
  const config = await getConfig(ctx.env);
  const channels = await cachedJson('live:channels', 'v1', 300, async () => {
    const lists = await Promise.all(
      config.liveSources.slice(0, 8).map(async (source) => {
        try {
          const res = await fetchUpstream(source.url, 10000);
          if (!res.ok) return [];
          return parseM3u(await res.text(), source.url, source.key, source.name);
        } catch {
          return [];
        }
      })
    );
    return mergeChannels(lists.flat());
  });
  return json({ channels });
}

/** 直播按需探测：一次最多 8 个地址，4 并发，避免打爆 Workers 的 subrequest 预算。 */
export async function probe(ctx: RouteContext): Promise<Response> {
  const urls = (ctx.url.searchParams.get('urls') || '')
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean)
    .slice(0, 8);
  if (!urls.length) return error('缺少探测地址', 400);

  const probeOne = async (url: string) => {
    const check = checkUpstream(url);
    if (!check.ok) return { url, ok: false, error: check.error, ms: 0 };
    const start = Date.now();
    try {
      const res = await fetchUpstream(url, 6000, { headers: { Range: 'bytes=0-1023' } });
      return { url, ok: res.ok || res.status === 206, status: res.status, ms: Date.now() - start };
    } catch (e) {
      return { url, ok: false, error: e instanceof Error ? e.message : '请求失败', ms: Date.now() - start };
    }
  };

  const results: Awaited<ReturnType<typeof probeOne>>[] = new Array(urls.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, urls.length) }, async () => {
      while (cursor < urls.length) {
        const index = cursor++;
        results[index] = await probeOne(urls[index]);
      }
    })
  );
  return json({ results });
}
