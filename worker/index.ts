import app from './app';
import { getHome } from './routes/config';
import type { Env } from './types';

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response> {
    return app.fetch(request, env, ctx);
  },

  /** Cron：每 30 分钟预热首页缓存，第一个访客直接命中边缘缓存。 */
  async scheduled(_controller: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    try {
      await getHome({
        req: new Request('https://denghuo.local/api/home'),
        env,
        url: new URL('https://denghuo.local/api/home'),
        params: {},
      });
    } catch {
      /* 预热失败不影响下一次自动重试 */
    }
  },
} satisfies ExportedHandler<Env>;
