import { describe, expect, it } from 'vitest';
import { mergeChannels, parseM3u } from './live';

const m3u = `#EXTM3U
#EXTINF:-1 tvg-id="cctv1" tvg-logo="https://img.example.com/cctv1.png" group-title="央视",CCTV-1 综合
https://live.example.com/cctv1.m3u8
#EXTINF:-1 group-title="央视",CCTV-1高清
https://live2.example.com/cctv1hd.m3u8
#EXTINF:-1,卫视
udp://239.1.1.1:1234
`;

describe('直播订阅解析', () => {
  it('解析 EXTINF 属性并丢弃非 http 协议', () => {
    const channels = parseM3u(m3u, 'https://list.example.com/index.m3u', 'src', '测试源');
    expect(channels).toHaveLength(2);
    expect(channels[0]).toMatchObject({ name: 'CCTV-1 综合', group: '央视' });
    expect(channels[0].logo).toBe('https://img.example.com/cctv1.png');
  });

  it('合并同名频道并保留多条线路', () => {
    const channels = parseM3u(m3u, 'https://list.example.com/index.m3u', 'src', '测试源');
    const merged = mergeChannels(channels);
    expect(merged).toHaveLength(1);
    expect(merged[0].urls).toHaveLength(2);
    expect(merged[0].sourceNames).toEqual(['测试源']);
  });
});
