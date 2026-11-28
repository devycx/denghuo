import { describe, expect, it } from 'vitest';
import {
  FALLBACK_ARTWORK,
  artworkType,
  buildMediaInfo,
  buildPositionState,
  resolveArtwork,
  upgradeDoubanArtwork,
} from './media-session';
import { centerSquareCrop, isNearlySquare } from './square-artwork';

describe('媒体卡片元数据', () => {
  it('无封面时用站点图标兜底', () => {
    expect(resolveArtwork()).toEqual({
      src: FALLBACK_ARTWORK,
      sizes: '512x512',
      type: 'image/png',
    });
  });

  it('封面走同源图片代理，并识别图片类型', () => {
    expect(resolveArtwork('https://img.example.com/poster.jpg')).toEqual({
      src: '/api/image?url=https%3A%2F%2Fimg.example.com%2Fposter.jpg',
      sizes: '512x512',
      type: 'image/jpeg',
    });
    expect(artworkType('https://a.com/x.webp')).toBe('image/webp');
    expect(artworkType('https://a.com/x')).toBeUndefined();
  });

  it('豆瓣小图升级到高清路径', () => {
    const small = 'https://img9.doubanio.com/view/photo/s_ratio_poster/public/p1.jpg';
    expect(upgradeDoubanArtwork(small)).toContain('/photo/m/');
    expect(resolveArtwork(small).sizes).toBe('540x800');
    expect(upgradeDoubanArtwork('https://img.example.com/s_ratio_poster/x.jpg'))
      .not.toContain('/photo/m/');
  });

  it('片名 + 集数，空片名有兜底', () => {
    expect(buildMediaInfo({ title: ' 夜幕 ', subtitle: ' 第 3 集 ', artwork: { src: 'x' } })).toEqual({
      title: '夜幕',
      artist: '第 3 集',
      artwork: [{ src: 'x' }],
    });
    expect(buildMediaInfo({ title: '  ' }).title).toBe('灯火影视');
    expect(buildMediaInfo({ title: '片名', subtitle: '  ' }).artist).toBeUndefined();
  });
});

describe('媒体卡片进度', () => {
  it('直播 / 未就绪的 duration 不写进度', () => {
    expect(buildPositionState(10, Infinity)).toBeNull();
    expect(buildPositionState(10, 0)).toBeNull();
    expect(buildPositionState(Number.NaN, 100)).toBeNull();
  });

  it('位置夹到 [0, duration]，倍速夹到合法区间', () => {
    expect(buildPositionState(-5, 100, 0)).toEqual({
      duration: 100,
      position: 0,
      playbackRate: 1,
    });
    expect(buildPositionState(200, 100, 99)).toEqual({
      duration: 100,
      position: 100,
      playbackRate: 16,
    });
  });
});

describe('通知栏方图裁切', () => {
  it('竖版海报取中间最大正方形，不放大', () => {
    expect(centerSquareCrop(540, 800)).toEqual({ sx: 0, sy: 130, source: 540, output: 512 });
    expect(centerSquareCrop(300, 300).output).toBe(300);
  });

  it('接近方图不再重新编码', () => {
    expect(isNearlySquare(512, 505)).toBe(true);
    expect(isNearlySquare(540, 800)).toBe(false);
  });
});
