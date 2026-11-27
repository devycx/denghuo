/** 全项目共用类型。Worker 侧不依赖 Node API，只用 Web 标准。 */

export interface Source {
  key: string;
  name: string;
  url: string;
  isAdult?: boolean;
  tier?: number;
}

export interface LiveSource {
  key: string;
  name: string;
  url: string;
}

export interface SearchItem {
  sourceKey: string;
  sourceName: string;
  vodId: string;
  name: string;
  pic?: string;
  typeName?: string;
  year?: string;
  area?: string;
  remarks?: string;
  isAdult?: boolean;
  /** 列表接口已带可播地址，无需额外详情请求即可过滤不可播条目 */
  playable?: boolean;
  /** 同名同年在其它源也出现了几条（聚合去重的副产物） */
  altCount?: number;
}

export interface Episode {
  name: string;
  url: string;
}

export interface PlayLine {
  name: string;
  episodes: Episode[];
}

export interface VideoDetail {
  sourceKey: string;
  sourceName: string;
  vodId: string;
  title: string;
  cover?: string;
  desc?: string;
  typeName?: string;
  year?: string;
  area?: string;
  director?: string;
  actor?: string;
  lines: PlayLine[];
}

export interface LiveChannel {
  id: string;
  name: string;
  group?: string;
  logo?: string;
  urls: string[];
  sourceNames: string[];
}

export interface SiteConfig {
  siteName: string;
  version: string;
  publicMode: boolean;
  kvEnabled: boolean;
  sources: Source[];
  liveSources: LiveSource[];
}

export interface Env {
  CONFIG_KV?: KVNamespace;
  SITE_NAME?: string;
  VERSION?: string;
  PUBLIC_MODE?: string;
  DEFAULT_SOURCES?: string;
  DEFAULT_LIVE_SOURCES?: string;
  ADMIN_PASSWORD?: string;
}

export interface RouteContext {
  req: Request;
  env: Env;
  url: URL;
  params: Record<string, string>;
}

export type RouteHandler = (ctx: RouteContext) => Promise<Response> | Response;
