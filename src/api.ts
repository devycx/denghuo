import type { DoubanHotItem, HomeRow, LiveChannel, SearchItem, SiteConfig, VideoDetail } from './types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || `请求失败（${res.status}）`);
  }
  return (await res.json()) as T;
}

function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export const api = {
  config: () => request<SiteConfig>('/api/config'),
  home: () => request<{ rows: HomeRow[] }>('/api/home'),
  douban: (type: 'tv' | 'movie', limit = 24) =>
    request<{ items: DoubanHotItem[] }>(`/api/douban?type=${type}&tag=%E7%83%AD%E9%97%A8&limit=${limit}`),
  search: (wd: string, sources?: string[], filterAdult = true) =>
    post<{ list: SearchItem[]; sourceCount: number }>('/api/search', { wd, sources, filterAdult }),
  detail: (source: string, id: string) =>
    request<VideoDetail>(`/api/detail?source=${encodeURIComponent(source)}&id=${encodeURIComponent(id)}`),
  multiDetail: (title: string, sources?: string[]) =>
    post<{ list: VideoDetail[] }>('/api/detail/multi', { title, sources }),
  channels: () => request<{ channels: LiveChannel[] }>('/api/live/channels'),
  probe: (urls: string[]) =>
    request<{ results: { url: string; ok: boolean; status?: number; error?: string; ms: number }[] }>(
      `/api/live/probe?urls=${encodeURIComponent(urls.join(','))}`
    ),
  adminStatus: () => request<{ kv: boolean; passwordSet: boolean }>('/api/admin/status'),
  adminUpdate: (body: { sources?: unknown; liveSources?: unknown }, password: string) =>
    request<{ ok: boolean }>('/api/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${password}` },
      body: JSON.stringify(body),
    }),
};

let adminToken = '';
export function setAdminToken(password: string): void {
  adminToken = password;
}

/** 图片走自己的 Worker 代理，避免盗链 / 混合内容问题，同时命中边缘缓存。 */
export function img(url?: string): string {
  return url ? `/api/image?url=${encodeURIComponent(url)}` : '';
}
