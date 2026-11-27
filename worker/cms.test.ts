import { describe, expect, it } from 'vitest';
import { dedupeAndSort, filterRelevant, parseDetail, parseVodList, relevance } from './cms';
import type { Source } from './types';

const source: Source = { key: 'a', name: '测试源', url: 'https://example.com/api', tier: 1 };

describe('CMS 解析', () => {
  it('解析搜索列表并识别成人分类', () => {
    const items = parseVodList(
      {
        list: [
          { vod_id: 1, vod_name: '测试电影', vod_pic: 'https://img.example.com/1.jpg', vod_year: '2024', vod_remarks: 'HD' },
          { vod_id: 2, vod_name: '伦理片', type_name: '伦理片' },
          { vod_name: '缺 ID' },
        ],
      },
      source
    );
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ vodId: '1', name: '测试电影', year: '2024' });
    expect(items[1].isAdult).toBe(true);
  });

  it('解析多线路分集，m3u8 线路优先', () => {
    const detail = parseDetail(
      {
        list: [
          {
            vod_id: 7,
            vod_name: '样例剧',
            vod_play_from: '网页$$m3u8',
            vod_play_url: '第1集$https://example.com/a.ts$$第1集$https://example.com/a.m3u8#第2集$https://example.com/b.m3u8',
            vod_content: '<p>简介<br>内容</p>',
          },
        ],
      },
      source
    );
    expect(detail.lines).toHaveLength(2);
    expect(detail.lines[0].name).toBe('m3u8');
    expect(detail.lines[0].episodes.map((e) => e.name)).toEqual(['第1集', '第2集']);
    expect(detail.desc).toBe('简介\n内容');
  });

  it('搜索丢弃上游误返回的不相关结果', () => {
    const items = parseVodList(
      {
        list: [
          { vod_id: 1, vod_name: '色戒', vod_play_url: 'https://img.example.com/a.m3u8' },
          { vod_id: 2, vod_name: '堕落色戒', vod_play_url: 'https://img.example.com/b.m3u8' },
          { vod_id: 3, vod_name: '苍蓝传承', vod_play_url: 'https://img.example.com/c.m3u8' },
          { vod_id: 4, vod_name: '爱·回家之三代同糖', vod_play_url: 'https://img.example.com/d.m3u8' },
        ],
      },
      source
    );
    expect(filterRelevant(items, '色戒').map((item) => item.name)).toEqual(['色戒', '堕落色戒']);
  });

  it('同名合并并记录其它源数量', () => {
    const a = parseVodList({ list: [{ vod_id: 1, vod_name: '流浪地球', vod_year: '2019' }] }, source);
    const b = parseVodList(
      { list: [{ vod_id: 9, vod_name: '流浪地球 2019', vod_year: '2019' }] },
      { ...source, key: 'b' }
    );
    const merged = dedupeAndSort([...a, ...b], '流浪地球');
    expect(merged).toHaveLength(1);
    expect(merged[0].altCount).toBe(1);
    expect(relevance('流浪地球', '流浪地球')).toBe(100);
  });
});
