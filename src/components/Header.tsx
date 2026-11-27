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
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setText(query), [query]);
  useEffect(() => {
    setMenuOpen(false);
  }, [route.path]);
  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = text.trim();
    if (!value) {
      setSearchOpen(false);
      return;
    }
    setSearchOpen(false);
    navigate(`/search?q=${encodeURIComponent(value)}`);
  };

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <a className="brand" href="#/" aria-label="返回首页">
          <span className="brand-name">{config?.siteName || '灯火影视'}</span>
        </a>

        <form className={`searchbar ${searchOpen ? 'open' : ''}`} onSubmit={submit} role="search">
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => !text && setSearchOpen(false)}
            placeholder="搜片名、演员……"
            aria-label="搜索"
          />
          <button type="submit" aria-label="搜索"><SearchIcon /></button>
        </form>

        <button
          className="icon-btn search-open"
          type="button"
          aria-label={searchOpen ? '收起搜索' : '展开搜索'}
          onClick={() => {
            setSearchOpen((v) => !v);
            setMenuOpen(false);
          }}
        >
          <SearchIcon />
        </button>

        <div className="menu-wrap" ref={menuRef}>
          <button
            className="icon-btn menu-btn"
            type="button"
            aria-label="菜单"
            aria-expanded={menuOpen}
            onClick={() => {
              setMenuOpen((v) => !v);
              setSearchOpen(false);
            }}
          >
            <MenuIcon />
          </button>
          {menuOpen && (
            <div className="menu-pop" role="menu">
              <button onClick={() => { setMenuOpen(false); navigate('/library?tab=history'); }}>历史记录</button>
              <button onClick={() => { setMenuOpen(false); navigate('/library?tab=favorites'); }}>我的收藏</button>
            </div>
          )}
        </div>

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
    </header>
  );
}
