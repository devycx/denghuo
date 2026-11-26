import { useEffect, useState } from 'react';
import { navigate, useRoute } from '../router';
import { useStore } from '../store';

const LINKS: { path: string; label: string; icon: string }[] = [
  { path: '/', label: '首页', icon: '⌂' },
  { path: '/live', label: '直播', icon: '▣' },
  { path: '/library', label: '我的', icon: '☆' },
  { path: '/settings', label: '设置', icon: '⚙' },
];

export function Header() {
  const route = useRoute();
  const { config } = useStore();
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
          <span className="brand-mark">火</span>
          <span className="brand-name">{config?.siteName || '灯火视频'}</span>
        </a>

        <form className="searchbar" onSubmit={submit} role="search">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="搜片名、演员……"
            aria-label="搜索"
          />
          <button type="submit" aria-label="搜索">
            搜
          </button>
        </form>

        <nav className="nav">
          {LINKS.map((link) => (
            <a
              key={link.path}
              href={`#${link.path}`}
              className={isActive(link.path) ? 'active' : ''}
              title={link.label}
            >
              <span className="nav-icon" aria-hidden="true">
                {link.icon}
              </span>
              <span className="nav-label">{link.label}</span>
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
