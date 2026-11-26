import type { Source } from './types';

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export function error(message: string, status = 500): Response {
  return json({ error: message }, status);
}

export async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

/** 带超时的上游 GET；超时用 AbortController 中断，避免拖死整次 Worker 调用。 */
export async function fetchUpstream(
  url: string,
  timeoutMs = 8000,
  init: RequestInit = {}
): Promise<Response> {
  const controller = new AbortController();
  const timer: ReturnType<typeof setTimeout> = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      ...init,
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: '*/*',
        ...(init.headers || {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

/** 苹果 CMS 接口地址拼接：兼容源地址本身已带查询参数的情况。 */
export function cmsUrl(base: string, params: Record<string, string>): string {
  const url = new URL(base);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

export function sourceFromUnknown(value: unknown, index: number): Source | null {
  if (!value || typeof value !== 'object') return null;
  const o = value as Record<string, unknown>;
  const url = typeof o.url === 'string' ? o.url.trim().replace(/\/+$/, '') : '';
  if (!/^https?:\/\//i.test(url)) return null;
  return {
    key: typeof o.key === 'string' && o.key ? o.key : `s${index + 1}`,
    name: typeof o.name === 'string' && o.name ? o.name : `源 ${index + 1}`,
    url,
    isAdult: Boolean(o.isAdult),
    tier: typeof o.tier === 'number' ? o.tier : 1,
  };
}
