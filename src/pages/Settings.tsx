import { useEffect, useState } from 'react';
import { api } from '../api';
import { ErrorState, Loading } from '../components/States';
import { toast } from '../components/Toast';
import { useStore } from '../store';

export function Settings() {
  const { settings, updateSettings, config, refreshConfig, history, favorites } = useStore();
  const [admin, setAdmin] = useState<{ kv: boolean; passwordSet: boolean } | null>(null);
  const [sourcesText, setSourcesText] = useState('');
  const [liveText, setLiveText] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.adminStatus().then(setAdmin).catch(() => setAdmin({ kv: false, passwordSet: false }));
  }, []);

  useEffect(() => {
    if (config) {
      setSourcesText(JSON.stringify(config.sources, null, 2));
      setLiveText(JSON.stringify(config.liveSources, null, 2));
    }
  }, [config]);

  const saveSources = async () => {
    setSaving(true);
    try {
      const sources = JSON.parse(sourcesText) as unknown;
      const liveSources = JSON.parse(liveText) as unknown;
      if (!Array.isArray(sources) || !Array.isArray(liveSources)) throw new Error('必须是 JSON 数组');
      if (!password) throw new Error('请先填写管理员密码');
      await api.adminUpdate({ sources, liveSources }, password);
      await refreshConfig();
      toast('配置已保存，边缘缓存将在 TTL 后刷新');
    } catch (e) {
      toast(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page settings-page">
      <div className="page-head">
        <div>
          <h1>设置</h1>
          <p className="muted">灯火视频 {config?.version || ''} · 偏好存在本机，源配置存在 Workers KV。</p>
        </div>
      </div>

      <section className="settings-section">
        <h2>播放与外观</h2>
        <div className="setting-row">
          <div>
            <strong>外观主题</strong>
            <p>深色更适合夜间观影</p>
          </div>
          <div className="segmented">
            <button className={settings.theme === 'dark' ? 'on' : ''} onClick={() => updateSettings({ theme: 'dark' })}>
              深色
            </button>
            <button className={settings.theme === 'light' ? 'on' : ''} onClick={() => updateSettings({ theme: 'light' })}>
              浅色
            </button>
          </div>
        </div>
        <ToggleRow
          title="自动连播"
          description="播完自动切下一集"
          checked={settings.autoplay}
          onChange={(v) => updateSettings({ autoplay: v })}
        />
        <ToggleRow
          title="过滤成人内容"
          description="搜索时跳过标记为 18+ 的源"
          checked={settings.adultFilter}
          onChange={(v) => updateSettings({ adultFilter: v })}
        />
      </section>

      <section className="settings-section">
        <h2>数据源管理</h2>
        {!admin ? (
          <Loading text="检查 KV 状态……" />
        ) : !admin.kv ? (
          <ErrorState message="尚未绑定 Workers KV：当前使用 wrangler.toml 里的默认源。创建 KV 并在 wrangler.toml 取消注释后即可在线管理。" />
        ) : (
          <>
            <p className="muted">
              点播源为苹果 CMS / mgdb 的 <code>?ac=videolist</code> 接口；直播源为 M3U 订阅地址。保存后最多 5 分钟生效（边缘缓存 TTL）。
            </p>
            <label className="field">
              点播源 JSON
              <textarea rows={10} spellCheck={false} value={sourcesText} onChange={(e) => setSourcesText(e.target.value)} />
            </label>
            <label className="field">
              直播源 JSON
              <textarea rows={6} spellCheck={false} value={liveText} onChange={(e) => setLiveText(e.target.value)} />
            </label>
            <label className="field">
              管理员密码
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="与 wrangler secret 保持一致" />
            </label>
            <button className="btn primary" disabled={saving} onClick={() => void saveSources()}>
              {saving ? '保存中……' : '保存配置'}
            </button>
          </>
        )}
      </section>

      <section className="settings-section">
        <h2>本机数据</h2>
        <p className="muted">
          观看记录 {history.length} 条 · 收藏 {favorites.length} 条。全部存在 localStorage，不上传服务器。
        </p>
        <button
          className="btn ghost"
          onClick={() => {
            localStorage.removeItem('denghuo:v1');
            window.location.reload();
          }}
        >
          重置本机数据
        </button>
      </section>
    </div>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="setting-row">
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      <button
        className={`switch ${checked ? 'on' : ''}`}
        role="switch"
        aria-checked={checked}
        aria-label={title}
        onClick={() => onChange(!checked)}
      >
        <span />
      </button>
    </div>
  );
}
