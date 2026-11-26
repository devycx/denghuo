import { error, json, readJson } from '../http';
import { saveConfig } from '../config';
import type { RouteContext } from '../types';

export async function adminStatus(ctx: RouteContext): Promise<Response> {
  return json({ kv: Boolean(ctx.env.CONFIG_KV), passwordSet: Boolean(ctx.env.ADMIN_PASSWORD) });
}

export async function adminUpdate(ctx: RouteContext): Promise<Response> {
  if (!ctx.env.CONFIG_KV) return error('未绑定 KV namespace，管理接口不可用', 503);
  if (!ctx.env.ADMIN_PASSWORD) return error('未设置管理员密码', 503);
  const auth = ctx.req.headers.get('Authorization') || '';
  if (auth !== `Bearer ${ctx.env.ADMIN_PASSWORD}`) return error('未授权', 401);

  const body = await readJson<{ sources?: unknown; liveSources?: unknown }>(ctx.req);
  if (!body) return error('请求格式错误', 400);
  try {
    await saveConfig(ctx.env, body);
    return json({ ok: true });
  } catch (e) {
    return error(e instanceof Error ? e.message : '保存失败', 400);
  }
}
