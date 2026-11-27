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
  altCount?: number;
}

export interface DoubanHotItem {
  id: string;
  title: string;
  cover: string;
  rating?: string;
  url?: string;
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

export interface FavoriteEntry {
  key: string;
  sourceKey: string;
  vodId: string;
  title: string;
  pic?: string;
  addedAt: number;
}

export interface HistoryEntry {
  key: string;
  sourceKey: string;
  vodId: string;
  title: string;
  pic?: string;
  epIndex: number;
  epName?: string;
  progress: number;
  updatedAt: number;
}

export interface Settings {
  theme: 'dark' | 'light';
  adultFilter: boolean;
  autoplay: boolean;
  selectedSources: string[];
}

export interface HomeRow {
  sourceKey: string;
  sourceName: string;
  items: SearchItem[];
}
