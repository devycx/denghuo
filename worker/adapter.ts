import type { Context } from 'hono';
import type { Env, RouteContext, RouteHandler } from './types';

/** 把原有的纯函数 handler 适配成 Hono handler，业务逻辑与框架解耦。 */
export function wrap(handler: RouteHandler) {
  return (c: Context<{ Bindings: Env }>): Promise<Response> | Response =>
    handler({
      req: c.req.raw,
      env: c.env,
      url: new URL(c.req.url),
      params: c.req.param() as Record<string, string>,
    });
}
