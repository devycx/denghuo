import { img } from '../api';

/**
 * 系统媒体卡片（手机通知栏 / 锁屏 / 桌面媒体控件）的纯逻辑：元数据构造、封面候选、进度夹取。
 * 不碰浏览器 API —— 注册 handler、写 navigator.mediaSession 在 components/use-media-session.ts。
 *
 * 字段与夜幕影视保持一致：卡片只出「片名 + 集数（或直播分组）」，不显示来源和总集数。
 */

export interface MediaArtwork {
  src: string;
  /** 声明尺寸会参与浏览器选图：太小可能被忽略，太大则会放大糊 */
  sizes?: string;
  type?: string;
}

export interface MediaInfo {
  title: string;
  /** 副标题行：点播是「第 3 集」，直播是分组或「直播」 */
  artist?: string;
  album?: string;
  artwork?: MediaArtwork[];
}

/** 无封面时的兜底：站点图标，同源、512、一定有 */
export const FALLBACK_ARTWORK = '/favicon-512.png';
const APP_NAME = '灯火影视';

const IMAGE_TYPES: ReadonlyArray<readonly [RegExp, string]> = [
  [/\.png(?:$|[?#])/i, 'image/png'],
  [/\.webp(?:$|[?#])/i, 'image/webp'],
  [/\.gif(?:$|[?#])/i, 'image/gif'],
  [/\.avif(?:$|[?#])/i, 'image/avif'],
  [/\.jpe?g(?:$|[?#])/i, 'image/jpeg'],
];

export function artworkType(src: string): string | undefined {
  for (const [pattern, type] of IMAGE_TYPES) {
    if (pattern.test(src)) return type;
  }
  return undefined;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/** 豆瓣 s_ratio_poster 只有 270×400，换 /m/ 后是 540×800，通知栏上更清楚。 */
export function upgradeDoubanArtwork(url: string): string {
  if (!url.includes('/s_ratio_poster/')) return url;
  if (!/(?:^|\.)doubanio\.com$/i.test(hostnameOf(url))) return url;
  return url.replace('/s_ratio_poster/', '/m/');
}

function absoluteUrl(path: string): string {
  if (typeof window === 'undefined') return path;
  return new URL(path, window.location.href).href;
}

/**
 * 封面 → artwork。系统取图时不会带本站 cookie/Referer，所以统一走 /api/image 同源代理，
 * 由 Worker 负责防盗链和缓存；再转成绝对地址（MediaMetadata 不接受相对路径）。
 */
export function resolveArtwork(cover?: string): MediaArtwork {
  if (!cover) {
    return { src: absoluteUrl(FALLBACK_ARTWORK), sizes: '512x512', type: 'image/png' };
  }
  const upgraded = upgradeDoubanArtwork(cover);
  const proxied = img(upgraded);
  if (!proxied) {
    return { src: absoluteUrl(FALLBACK_ARTWORK), sizes: '512x512', type: 'image/png' };
  }
  return {
    src: absoluteUrl(proxied),
    sizes: /\/photo\/m\//.test(upgraded) ? '540x800' : '512x512',
    type: artworkType(upgraded),
  };
}

export function buildMediaInfo(input: {
  title: string;
  subtitle?: string;
  artwork?: MediaArtwork;
}): MediaInfo {
  const info: MediaInfo = { title: input.title.trim() || APP_NAME };
  const subtitle = input.subtitle?.trim();
  if (subtitle) info.artist = subtitle;
  if (input.artwork) info.artwork = [input.artwork];
  return info;
}

export interface PositionState {
  duration: number;
  position: number;
  playbackRate: number;
}

/**
 * `setPositionState` 对入参很挑：duration 必须有限且为正、position 落在 [0, duration]、
 * playbackRate 在 [0.0625, 16]。直播流（duration = Infinity）和元数据未就绪时返回 null，
 * 由调用方跳过 —— 硬塞非法值在 Safari 上会抛异常。
 */
export function buildPositionState(
  position: number,
  duration: number,
  playbackRate = 1
): PositionState | null {
  if (!Number.isFinite(duration) || duration <= 0) return null;
  if (!Number.isFinite(position)) return null;
  const rate = Number.isFinite(playbackRate) && playbackRate > 0 ? playbackRate : 1;
  return {
    duration,
    position: Math.min(Math.max(position, 0), duration),
    playbackRate: Math.min(Math.max(rate, 0.0625), 16),
  };
}

/** Safari 15 早期版本只有 mediaSession 没有 MediaMetadata，缺一个就当不支持。 */
export function supportsMediaSession(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof MediaMetadata !== 'undefined' &&
    'mediaSession' in navigator &&
    Boolean(navigator.mediaSession)
  );
}
