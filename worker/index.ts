import app from './app';
import { getHome } from './routes/config';
import { getDoubanHot } from './routes/douban';
import type { Env } from './types';

function ctx(path: string, env: Env) {
  return {
    req: new Request(`https://denghuo.local${path}`),
    env,
    url: new URL(`https://denghuo.local${path}`),
    params: {},
  };
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response> {
    return app.fetch(request, env, ctx);
  },

  /** Cron：每 30 分钟预热首页缓存，第一个访客直接命中边缘缓存。 */
  async scheduled(_controller: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    const paths = [
      '/api/home',
      '/api/douban?type=tv&tag=%E7%83%AD%E9%97%A8&limit=18',
      '/api/douban?type=movie&tag=%E7%83%AD%E9%97%A8&limit=18',
      '/api/douban?type=tv&tag=%E5%9B%BD%E4%BA%A7%E5%89%A7&limit=18',
      '/api/douban?type=movie&tag=%E7%BB%8F%E5%85%B8&limit=18',
    ];
    await Promise.allSettled(
      paths.map(async (path) => {
        if (path === '/api/home') await getHome(ctx(path, env));
        else await getDoubanHot(ctx(path, env));
      })
    );
  },
} satisfies ExportedHandler<Env>;
