import { sourceFromUnknown } from './http';
import type { Env, LiveSource, SiteConfig, Source } from './types';

function parseSources(raw: string | undefined): Source[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.map(sourceFromUnknown).filter((s): s is Source => Boolean(s));
  } catch {
    return [];
  }
}

function parseLiveSources(raw: string | undefined): LiveSource[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
      .map((item, i) => ({
        key: typeof item.key === 'string' && item.key ? item.key : `live${i + 1}`,
        name: typeof item.name === 'string' && item.name ? item.name : `直播源 ${i + 1}`,
        url: typeof item.url === 'string' ? item.url.trim() : '',
      }))
      .filter((s) => /^https?:\/\//i.test(s.url));
  } catch {
    return [];
  }
}

/** KV 有数据时优先 KV，否则回退到 wrangler vars —— 没创建 KV 也能完整跑起来。 */
export async function getConfig(env: Env): Promise<SiteConfig> {
  let sources = parseSources(env.DEFAULT_SOURCES);
  let liveSources = parseLiveSources(env.DEFAULT_LIVE_SOURCES);

  if (env.CONFIG_KV) {
    const [storedSources, storedLive] = await Promise.all([
      env.CONFIG_KV.get('sources'),
      env.CONFIG_KV.get('liveSources'),
    ]);
    const a = parseSources(storedSources ?? undefined);
    const b = parseLiveSources(storedLive ?? undefined);
    if (a.length) sources = a;
    if (b.length) liveSources = b;
  }

  return {
    siteName: env.SITE_NAME || '灯火视频',
    version: env.VERSION || '1.0.0',
    publicMode: env.PUBLIC_MODE !== '0',
    kvEnabled: Boolean(env.CONFIG_KV),
    sources,
    liveSources,
  };
}

export async function saveConfig(
  env: Env,
  patch: { sources?: unknown; liveSources?: unknown }
): Promise<void> {
  if (!env.CONFIG_KV) throw new Error('未绑定 KV namespace');
  const writes: Promise<void>[] = [];
  if (patch.sources !== undefined) {
    if (!Array.isArray(patch.sources)) throw new Error('sources 必须是数组');
    writes.push(env.CONFIG_KV.put('sources', JSON.stringify(patch.sources)));
  }
  if (patch.liveSources !== undefined) {
    if (!Array.isArray(patch.liveSources)) throw new Error('liveSources 必须是数组');
    writes.push(env.CONFIG_KV.put('liveSources', JSON.stringify(patch.liveSources)));
  }
  await Promise.all(writes);
}
