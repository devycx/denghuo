/** Cloudflare Cache API 边缘缓存封装：Workers 免费额度内无额外费用。 */

type CacheStore = CacheStorage & { default?: Cache };

function getCache(): Cache | null {
  try {
    const store = typeof caches !== 'undefined' ? (caches as CacheStore) : undefined;
    return store?.default ?? null;
  } catch {
    return null;
  }
}

export async function hashKey(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}

function cacheRequest(key: string): Request {
  return new Request(`https://cache.denghuo.video/__dh/${key}`);
}

/** 命中边缘缓存直接返回；未命中调用 producer 并异步回填。 */
export async function cachedJson<T>(
  namespace: string,
  identity: string,
  ttlSec: number,
  producer: () => Promise<T>
): Promise<T> {
  const key = await hashKey(`${namespace}:${identity}`);
  const cache = getCache();
  const req = cacheRequest(key);
  if (cache) {
    try {
      const hit = await cache.match(req);
      if (hit && hit.ok) return (await hit.json()) as T;
    } catch {
      /* 缓存损坏则当作未命中 */
    }
  }

  const data = await producer();
  if (cache) {
    try {
      const res = new Response(JSON.stringify(data), {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': `public, max-age=${ttlSec}`,
        },
      });
      void cache.put(req, res).catch(() => {});
    } catch {
      /* 写入失败不影响结果 */
    }
  }
  return data;
}

export async function getCachedResponse(key: string): Promise<Response | null> {
  const cache = getCache();
  if (!cache) return null;
  try {
    const hit = await cache.match(cacheRequest(key));
    return hit && hit.ok ? hit : null;
  } catch {
    return null;
  }
}

export async function putCachedResponse(key: string, res: Response, ttlSec: number): Promise<void> {
  const cache = getCache();
  if (!cache) return;
  try {
    const copy = new Response(res.body, {
      status: res.status,
      headers: { ...Object.fromEntries(res.headers), 'Cache-Control': `public, max-age=${ttlSec}` },
    });
    void cache.put(cacheRequest(key), copy).catch(() => {});
  } catch {
    /* 忽略 */
  }
}
