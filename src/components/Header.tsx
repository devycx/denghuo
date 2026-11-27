import { useEffect, useState } from 'react';
import { navigate, useRoute } from '../router';
import { useStore } from '../store';
import { originFrom, transitionToTheme } from '../theme';

const LINKS: { path: string; label: string }[] = [
  { path: '/', label: '首页' },
  { path: '/live', label: '直播' },
  { path: '/library', label: '我的' },
  { path: '/settings', label: '设置' },
];

export function Header() {
  const route = useRoute();
  const { config, settings, updateSettings } = useStore();
  const query = route.params.get('q') || '';
  const [text, setText] = useState(query);

  useEffect(() => setText(query), [query]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = text.trim();
    if (value) navigate(`/search?q=${encodeURIComponent(value)}`);
  };

  const isActive = (path: string) =>
    path === '/' ? route.path === '/' || route.path === '/search' : route.path === path;

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <a className="brand" href="#/" aria-label="返回首页">
          <span className="brand-name">{config?.siteName || '灯火影视'}</span>
        </a>

        <form className="searchbar" onSubmit={submit} role="search">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="搜片名、演员……"
            aria-label="搜索"
          />
          <button type="submit" aria-label="搜索">
            🔍
          </button>
        </form>

        <nav className="nav">
          {LINKS.map((link) => (
            <a
              key={link.path}
              href={`#${link.path}`}
              className={isActive(link.path) ? 'active' : ''}
              aria-current={isActive(link.path) ? 'page' : undefined}
            >
              <span className="nav-label">{link.label}</span>
            </a>
          ))}
          <button
            className="theme-toggle"
            type="button"
            aria-label={settings.theme === 'light' ? '切换到深色主题' : '切换到浅色主题'}
            title={settings.theme === 'light' ? '深色主题' : '浅色主题'}
            onClick={(e) => {
              const next = settings.theme === 'light' ? 'dark' : 'light';
              transitionToTheme(next, originFrom(e.currentTarget), () => updateSettings({ theme: next }));
            }}
          >
            {settings.theme === 'light' ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
                <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8 6 18M18 6l1.8-1.8" />
              </svg>
            )}
          </button>
        </nav>
      </div>
    </header>
  );
}
