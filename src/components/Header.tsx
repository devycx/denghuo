import { useEffect, useRef, useState } from 'react';
import { navigate, useRoute } from '../router';
import { useStore } from '../store';
import { originFrom, transitionToTheme } from '../theme';

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
      <circle cx="10.8" cy="10.8" r="6.4" />
      <path d="m15.6 15.6 4.4 4.4" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function Header() {
  const route = useRoute();
  const { config, settings, updateSettings } = useStore();
  const query = route.params.get('q') || '';
  const [text, setText] = useState(query);
  const [searchOpen, setSearchOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // 三横线第一次进「历史记录 / 收藏」，第二次回到进来之前的页面。
  const backRef = useRef('/');

  useEffect(() => setText(query), [query]);
  useEffect(() => {
    setSearchOpen(false);
    if (route.path !== '/library') backRef.current = window.location.hash.slice(1) || '/';
  }, [route.path]);
  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
    else inputRef.current?.blur();
  }, [searchOpen]);

  const submit = (event?: React.FormEvent) => {
    event?.preventDefault();
    const value = text.trim();
    setSearchOpen(false);
    if (!value) return;
    navigate(`/search?q=${encodeURIComponent(value)}`);
  };

  // 同一枚图标：收起态点开，展开态有内容就搜索、没内容就收起。
  const onSearchClick = () => {
    if (!searchOpen) {
      setSearchOpen(true);
      return;
    }
    if (text.trim()) submit();
    else setSearchOpen(false);
  };

  const onMenuClick = () => {
    if (route.path === '/library') navigate(backRef.current || '/');
    else {
      backRef.current = window.location.hash.slice(1) || '/';
      navigate('/library');
    }
  };

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <a className="brand" href="#/" aria-label="返回首页">
          <span className="brand-name">{config?.siteName || '灯火影视'}</span>
        </a>

        <div className="header-actions">
          <form className={`searchbar ${searchOpen ? 'open' : ''}`} onSubmit={submit} role="search">
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setSearchOpen(false);
              }}
              placeholder="搜片名、演员……"
              aria-label="搜索"
            />
          </form>
          <button
            className="icon-btn search-toggle"
            type="button"
            aria-label={searchOpen ? (text.trim() ? '搜索' : '收起搜索') : '展开搜索'}
            aria-expanded={searchOpen}
            onClick={onSearchClick}
          >
            <SearchIcon />
          </button>

          <button
            className="icon-btn menu-btn"
            type="button"
            aria-label={route.path === '/library' ? '返回原界面' : '历史记录与收藏'}
            title={route.path === '/library' ? '返回原界面' : '历史记录与收藏'}
            onClick={onMenuClick}
          >
            <MenuIcon />
          </button>

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
        </div>
      </div>
    </header>
  );
}
