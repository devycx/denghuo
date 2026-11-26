import type { LiveChannel } from './types';

/** M3U 订阅解析 + 跨源频道合并（原创实现）。 */

interface Parsed extends LiveChannel {
  sourceKey: string;
  sourceName: string;
}

const ATTR_RE = /([a-zA-Z0-9_-]+)="([^"]*)"/g;

export function parseM3u(text: string, baseUrl: string, sourceKey: string, sourceName: string): Parsed[] {
  const result: Parsed[] = [];
  const seen = new Set<string>();
  let attrs: Record<string, string> = {};
  let title = '';
  let group = '';

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (/^#EXTINF/i.test(trimmed)) {
      attrs = {};
      ATTR_RE.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = ATTR_RE.exec(trimmed))) attrs[match[1].toLowerCase()] = match[2];
      const rest = trimmed.replace(ATTR_RE, '').replace(/^#EXTINF\s*:[^,]*,?/i, '');
      title = rest.trim().replace(/^"|"$/g, '');
      group = '';
      continue;
    }
    if (/^#EXTGRP:/i.test(trimmed)) {
      group = trimmed.slice(8).trim();
      continue;
    }
    if (trimmed.startsWith('#')) continue;

    let url: string;
    try {
      url = new URL(trimmed, baseUrl).toString();
    } catch {
      continue;
    }
    if (!/^https?:$/.test(new URL(url).protocol) || seen.has(url)) continue;
    seen.add(url);

    const name = title || decodeURIComponent(new URL(url).pathname.split('/').pop() || '') || new URL(url).hostname;
    const id = `${sourceKey}:${url}`;
    result.push({
      id,
      name,
      group: attrs['group-title'] || group || undefined,
      logo: attrs['tvg-logo'] || undefined,
      urls: [url],
      sourceNames: [sourceName],
      sourceKey,
      sourceName,
    });
    attrs = {};
    title = '';
    group = '';
  }
  return result;
}

function channelKey(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[\s\-_·]/g, '')
    .replace(/(高清|标清|超清|综合|卫视|hd|sd|4k|1080p|频道|台)/gi, '')
    .replace(/[（）()【】]/g, '');
}

/** 按归一化频道名合并：CCTV-1 综合 / CCTV1高清 / 央视一套 仍可能分开，但常见写法能收敛。 */
export function mergeChannels(channels: Parsed[], maxUrls = 8): LiveChannel[] {
  const map = new Map<string, LiveChannel>();
  for (const ch of channels) {
    const key = channelKey(ch.name) || ch.name;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        id: key,
        name: ch.name,
        group: ch.group,
        logo: ch.logo,
        urls: ch.urls.slice(0, maxUrls),
        sourceNames: [...ch.sourceNames],
      });
      continue;
    }
    if (!existing.logo && ch.logo) existing.logo = ch.logo;
    if (!existing.group && ch.group) existing.group = ch.group;
    for (const url of ch.urls) {
      if (existing.urls.length >= maxUrls) break;
      if (!existing.urls.includes(url)) existing.urls.push(url);
    }
    if (!existing.sourceNames.includes(ch.sourceName)) existing.sourceNames.push(ch.sourceName);
  }
  return Array.from(map.values()).sort(
    (a, b) => (a.group || '').localeCompare(b.group || '', 'zh-CN') || a.name.localeCompare(b.name, 'zh-CN')
  );
}
