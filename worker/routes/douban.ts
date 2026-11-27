import { cachedJson } from '../cache';
import { error, fetchUpstream, json } from '../http';
import type { RouteContext } from '../types';

/**
 * 豆瓣热门（沿用夜幕影视的服务端直连方案）：
 * 1) movie.douban.com/j/search_subjects?tag=热门 —— 豆瓣官方推荐接口
 * 2) 失败降级到 60s API 的豆瓣周榜（与夜幕影视 hot-list 同源）
 * 统一输出 { id, title, cover, rating?, url? }，边缘缓存 10 分钟。
 */
export interface DoubanHotItem {
  id: string;
  title: string;
  cover: string;
  rating?: string;
  url?: string;
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

interface RawSubject {
  id?: string;
  title?: string;
  cover?: string;
  rate?: string;
  url?: string;
}

interface WeeklyItem {
  id?: string | number;
  title?: string;
  cover?: string;
  cover_proxy?: string;
  rating?: number;
  url?: string;
}

function clean(items: DoubanHotItem[], limit: number): DoubanHotItem[] {
  const seen = new Set<string>();
  return items
    .filter((item) => {
      if (!item.title || !item.cover || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .slice(0, limit);
}

async function fromDouban(type: string, tag: string, limit: number): Promise<DoubanHotItem[]> {
  const url =
    `https://movie.douban.com/j/search_subjects?type=${type}` +
    `&tag=${encodeURIComponent(tag)}&sort=recommend&page_limit=${limit}&page_start=0`;
  const res = await fetchUpstream(url, 8000, {
    headers: { 'User-Agent': UA, Referer: 'https://movie.douban.com/', Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`豆瓣响应 ${res.status}`);
  const data = (await res.json()) as { subjects?: RawSubject[] };
  if (!Array.isArray(data.subjects)) throw new Error('豆瓣数据异常');
  return data.subjects.map((s) => ({
    id: String(s.id || ''),
    title: s.title || '',
    cover: s.cover || '',
    rating: s.rate && s.rate !== '0' ? s.rate : undefined,
    url: s.url,
  }));
}

async function fromWeekly(type: string, limit: number): Promise<DoubanHotItem[]> {
  const category = type === 'movie' ? 'movie' : 'tv_chinese';
  const url = `https://60s.crystelf.top/v2/douban/weekly/${category}`;
  const res = await fetchUpstream(url, 8000, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`周榜响应 ${res.status}`);
  const data = (await res.json()) as { data?: WeeklyItem[] };
  if (!Array.isArray(data.data)) throw new Error('周榜数据异常');
  return data.data.map((item) => ({
    id: String(item.id || ''),
    title: item.title || '',
    cover: item.cover || item.cover_proxy || '',
    rating: item.rating && item.rating > 0 ? String(item.rating) : undefined,
    url: item.url,
  }));
}

export async function getDoubanHot(ctx: RouteContext): Promise<Response> {
  const type = ctx.url.searchParams.get('type') === 'movie' ? 'movie' : 'tv';
  const tag = (ctx.url.searchParams.get('tag') || '热门').slice(0, 20);
  const limit = Math.min(40, Math.max(1, parseInt(ctx.url.searchParams.get('limit') || '24', 10) || 24));

  try {
    const items = await cachedJson(`douban:${type}:${tag}`, String(limit), 600, async () => {
      try {
        return clean(await fromDouban(type, tag, limit), limit);
      } catch {
        return clean(await fromWeekly(type, limit), limit);
      }
    });
    if (items.length === 0) throw new Error('热门数据为空');
    return json({ items });
  } catch (e) {
    return error(e instanceof Error ? e.message : '热门数据获取失败', 502);
  }
}
