import { describe, expect, it } from 'vitest';
import { checkUpstream } from './ssrf';

describe('SSRF 校验', () => {
  it('放行公网 http/https', () => {
    expect(checkUpstream('https://example.com/api').ok).toBe(true);
    expect(checkUpstream('http://8.8.8.8/api').ok).toBe(true);
  });

  it('拦截本地与内网地址', () => {
    for (const url of [
      'http://127.0.0.1:8080',
      'http://localhost/admin',
      'https://10.0.0.1',
      'https://192.168.1.1',
      'https://172.16.5.4',
      'https://169.254.169.254/latest/meta-data',
      'http://[::1]/',
      'file:///etc/passwd',
      'ftp://example.com/x',
      'https://user:pass@example.com/',
    ]) {
      expect(checkUpstream(url).ok, url).toBe(false);
    }
  });

  it('拒绝空地址与非法格式', () => {
    expect(checkUpstream('').ok).toBe(false);
    expect(checkUpstream('not a url').ok).toBe(false);
  });
});
