import type { Episode, PlayLine, SearchItem, Source, VideoDetail } from './types';

/** 苹果 CMS / mgdb 采集接口的原创解析器（不复用夜幕影视代码）。 */

const PLAY_SPLIT = /\$\$\$?/;

export function stripHtml(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?p[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function str(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number') return String(value);
  return undefined;
}

export function normalizeTitle(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[\s\p{P}\p{S}]+/gu, '')
    .replace(/更新至?第?\d+集?|第?\d+集?完结|已完结|完结/g, '')
    .replace(/(19|20)\d{2}$/, '')
    .replace(/^(电影|电视剧|连续剧|综艺|动漫)/, '')
    .replace(/(高清|超清|完整版|国语|粤语|全集|正片)$/g, '');
}

/** 上游常把「无匹配」当成全站列表返回；相关性为 0 的条目一律不算结果。 */
export function filterRelevant(items: SearchItem[], keyword: string): SearchItem[] {
  return items.filter((item) => relevance(item.name, keyword) >= 30);
}

/** 简单相关性打分：精确 > 前缀 > 包含，带年份/别名容错。 */
export function relevance(name: string, keyword: string): number {
  const a = normalizeTitle(name);
  const b = normalizeTitle(keyword);
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (a.startsWith(b)) return 80;
  if (b.startsWith(a)) return 60;
  if (a.includes(b)) return 50;
  if (b.includes(a)) return 30;
  return 0;
}

export function parseVodList(data: unknown, source: Source): SearchItem[] {
  if (!data || typeof data !== 'object') return [];
  const raw = (data as { list?: unknown }).list;
  if (!Array.isArray(raw)) return [];
  const items: SearchItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const v = entry as Record<string, unknown>;
    const name = str(v.vod_name);
    const vodId = str(v.vod_id);
    if (!name || !vodId) continue;
    const typeName = str(v.vod_type) || str(v.type_name);
    const pic = str(v.vod_pic);
    const playUrl = str(v.vod_play_url) || '';
    const playable = /https?:\/\//i.test(playUrl) && /(m3u8|mp4|\.ts)(?:[?#]|$)/i.test(playUrl);
    items.push({
      sourceKey: source.key,
      sourceName: source.name,
      vodId,
      name,
      pic: pic && /^https?:\/\//i.test(pic) ? pic : undefined,
      typeName,
      year: str(v.vod_year),
      area: str(v.vod_area),
      remarks: str(v.vod_remarks),
      playable,
      isAdult: Boolean(source.isAdult) || /成人|伦理|情色|艳|成人片/.test(typeName || ''),
    });
  }
  return items;
}

function parseEpisodes(raw: string): Episode[] {
  const episodes: Episode[] = [];
  for (const [i, chunk] of String(raw || '').split('#').entries()) {
    const text = chunk.trim();
    if (!text) continue;
    const cut = text.lastIndexOf('$');
    const name = cut > 0 ? text.slice(0, cut).trim() : `第 ${i + 1} 集`;
    const url = (cut > 0 ? text.slice(cut + 1) : text).trim();
    if (/^https?:\/\//i.test(url)) episodes.push({ name, url });
  }
  return episodes;
}

function extractM3u8(text: string): string[] {
  const found = text.match(/https?:\/\/[^"'\s<>]+?\.m3u8[^\s"'<>]*/gi) || [];
  return found.map((u) => u.replace(/^\$/, ''));
}

export function parseDetail(data: unknown, source: Source): VideoDetail {
  const raw = (data as { list?: unknown[] } | null)?.list;
  if (!Array.isArray(raw) || !raw[0] || typeof raw[0] !== 'object') {
    throw new Error('详情数据无效');
  }
  const v = raw[0] as Record<string, unknown>;
  const content = String(v.vod_content ?? '');
  const fromNames = String(v.vod_play_from ?? '').split(PLAY_SPLIT).filter(Boolean);
  const groups = String(v.vod_play_url ?? '').split(PLAY_SPLIT).filter(Boolean);
  const lines: PlayLine[] = groups.map((group, i) => ({
    name: fromNames[i] || `线路 ${i + 1}`,
    episodes: parseEpisodes(group),
  }));

  let usable = lines.filter((line) => line.episodes.length > 0);
  if (usable.length === 0) {
    const fallback = extractM3u8(content);
    if (fallback.length) usable = [{ name: '默认线路', episodes: fallback.map((url, i) => ({ name: `第 ${i + 1} 集`, url })) }];
  }
  // m3u8 直线路优先展示，减少用户切线路的点击
  usable.sort((a, b) => {
    const aM = a.episodes.some((e) => e.url.includes('.m3u8')) ? 1 : 0;
    const bM = b.episodes.some((e) => e.url.includes('.m3u8')) ? 1 : 0;
    return bM - aM;
  });

  return {
    sourceKey: source.key,
    sourceName: source.name,
    vodId: String(v.vod_id ?? ''),
    title: str(v.vod_name) || '未命名',
    cover: (() => {
      const pic = str(v.vod_pic);
      return pic && /^https?:\/\//i.test(pic) ? pic : undefined;
    })(),
    desc: stripHtml(content).replace(/https?:\/\/\S+/g, '').trim() || undefined,
    typeName: str(v.vod_type) || str(v.type_name),
    year: str(v.vod_year),
    area: str(v.vod_area),
    director: str(v.vod_director),
    actor: str(v.vod_actor),
    lines: usable,
  };
}

const yearNumber = (year?: string): number => {
  const n = parseInt(year || '', 10);
  return Number.isFinite(n) ? n : 0;
};

/** 同名合并 + 相关性排序：这是聚合站「取精」的关键一步。 */
export function dedupeAndSort(items: SearchItem[], keyword: string): SearchItem[] {
  const buckets = new Map<string, SearchItem>();
  for (const item of items) {
    const key = `${normalizeTitle(item.name)}|${item.year || ''}`;
    const prev = buckets.get(key);
    if (!prev) {
      buckets.set(key, { ...item, altCount: 0 });
      continue;
    }
    prev.altCount = (prev.altCount || 0) + 1;
    const better =
      relevance(item.name, keyword) > relevance(prev.name, keyword) ||
      (relevance(item.name, keyword) === relevance(prev.name, keyword) && !prev.pic && Boolean(item.pic));
    if (better) buckets.set(key, { ...item, altCount: prev.altCount });
  }
  const list = Array.from(buckets.values());
  list.sort((a, b) => {
    const diff = relevance(b.name, keyword) - relevance(a.name, keyword);
    if (diff) return diff;
    const yearDiff = yearNumber(b.year) - yearNumber(a.year);
    if (yearDiff) return yearDiff;
    return a.name.localeCompare(b.name, 'zh-CN');
  });
  return list;
}
