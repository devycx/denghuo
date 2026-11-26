import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { wrap } from './adapter';
import type { Env } from './types';
import { getHealth, getHome, getSiteConfig } from './routes/config';
import { multiDetail, search } from './routes/search';
import { getDetail } from './routes/detail';
import { getChannels, probe } from './routes/live';
import { proxyImage } from './routes/image';
import { adminStatus, adminUpdate } from './routes/admin';

const app = new Hono<{ Bindings: Env }>();

// Hono 官方 CORS 中间件顺带处理 OPTIONS 预检，替掉手写的 header 与 withCors。
app.use(
  '/api/*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'Range'],
  })
);

app.get('/api/health', wrap(getHealth));
app.get('/api/config', wrap(getSiteConfig));
app.get('/api/home', wrap(getHome));
app.post('/api/search', wrap(search));
app.post('/api/detail/multi', wrap(multiDetail));
app.get('/api/detail', wrap(getDetail));
app.get('/api/live/channels', wrap(getChannels));
app.get('/api/live/probe', wrap(probe));
app.get('/api/image', wrap(proxyImage));
app.get('/api/admin/status', wrap(adminStatus));
app.post('/api/admin/config', wrap(adminUpdate));

app.notFound((c) => c.json({ error: '接口不存在' }, 404));
app.onError((err, c) => c.json({ error: err.message || '服务异常' }, 500));

export default app;
