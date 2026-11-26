import { describe, expect, it } from 'vitest';
import app from './app';
import type { Env } from './types';

describe('Hono 应用', () => {
  it('健康接口返回 JSON 且带 CORS', async () => {
    const res = await app.request('/api/health', {}, {} as Env);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, service: 'denghuo' });
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('OPTIONS 预检由 Hono 中间件处理', async () => {
    const res = await app.request('/api/search', {
      method: 'OPTIONS',
      headers: { Origin: 'https://example.com', 'Access-Control-Request-Method': 'POST' },
    }, {} as Env);
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('未知接口返回 404 JSON', async () => {
    const res = await app.request('/api/nope', {}, {} as Env);
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: '接口不存在' });
  });
});
