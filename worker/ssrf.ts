/**
 * 轻量 SSRF 防护：用户可在设置里填任意源地址，服务端发起请求前必须校验。
 * Workers 无法直接拿到 DNS 解析结果，所以这里做「协议白名单 + 字面量内网地址 + 本地域名后缀」，
 * 拦住绝大多数误配置和恶意内网探测。
 */

export type UrlCheck = { ok: true; url: URL } | { ok: false; error: string };

function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    h === 'localhost' ||
    h.endsWith('.localhost') ||
    h.endsWith('.local') ||
    h.endsWith('.internal') ||
    h.endsWith('.lan') ||
    h.endsWith('.test')
  ) {
    return true;
  }

  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }

  if (h.includes(':')) {
    if (h === '::' || h === '::1' || h.startsWith('::ffff:')) return true;
    if (/^f[cd]/.test(h)) return true; // fc00::/7 唯一本地地址
    if (/^fe[89ab]/.test(h)) return true; // fe80::/10 链路本地
  }
  return false;
}

export function checkUpstream(raw: string): UrlCheck {
  if (!raw || typeof raw !== 'string') return { ok: false, error: '地址为空' };
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: '地址格式无效' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, error: '仅支持 http/https 地址' };
  }
  if (url.username || url.password) {
    return { ok: false, error: '地址不允许包含账号密码' };
  }
  if (isPrivateHost(url.hostname)) {
    return { ok: false, error: '不允许访问内网地址' };
  }
  return { ok: true, url };
}
