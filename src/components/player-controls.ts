import type ArtplayerType from 'artplayer';

/**
 * 播放器控件（对齐夜幕影视的最终交互）：
 * - 全屏按钮用 ArtPlayer 风格的实心图标，进入/退出两枚随状态切换；
 * - 手机原生全屏优先（吞掉地址栏/状态栏），随后尽量锁横屏；锁失败也保留原生全屏，
 *   只有浏览器连原生全屏都不支持时才退化到 CSS 旋转横屏（此时无法隐藏浏览器 UI）；
 * - 小窗按钮与上一集/下一集按钮作为自定义控件注册进 ArtPlayer 控制条。
 */

// 用 ArtPlayer 原版完整路径：此前用整数简化版，右下角那段坐标画错，
// 全屏后「退出全屏」图标真的少一角（用户截图确认），不是安全区/圆角裁切问题。
const fullscreenEnter = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 1024 1024" style="fill:currentColor;overflow:visible"><path d="M625.777778 256h142.222222V398.222222h113.777778V142.222222H625.777778v113.777778zM256 398.222222V256H398.222222v-113.777778H142.222222V398.222222h113.777778zM768 625.777778v142.222222H625.777778v113.777778h256V625.777778h-113.777778zM398.222222 768H256V625.777778h-113.777778v256H398.222222v-113.777778z"/></svg>`;
const fullscreenExit = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 1024 1024" style="fill:currentColor;overflow:visible;display:none"><path d="M768 298.666667h170.666667v85.333333h-256V128h85.333333v170.666667zM341.333333 384H85.333333V298.666667h170.666667V128h85.333333v256z m426.666667 341.333333v170.666667h-85.333333v-256h256v85.333333h-170.666667zM341.333333 640v256H256v-170.666667H85.333333v-85.333333h256z"/></svg>`;

export const fullscreenButtonHtml = fullscreenEnter + fullscreenExit;

const pipEnter = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" style="fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M12 15h8v-4h-8z" fill="currentColor" stroke="none"/></svg>`;
const pipExit = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" style="fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;display:none"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M14 13h6m-2-2 2 2-2 2"/></svg>`;

export const pipButtonHtml = pipEnter + pipExit;

export const prevIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" style="fill:currentColor"><path d="M6 5h2.5v14H6zm12 1.2v11.6L9.8 12z"/></svg>`;
export const nextIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" style="fill:currentColor"><path d="M15.5 5H18v14h-2.5zM6 6.2v11.6L14.2 12z"/></svg>`;

function swapIcons(selector: string, on: boolean): void {
  // 网页全屏时 ArtPlayer 会把根节点挂到 body 下，必须全局查询。
  const button = document.querySelector<HTMLElement>(selector);
  if (!button) return;
  const icons = Array.from(button.children) as HTMLElement[];
  if (icons[0]) icons[0].style.display = on ? 'none' : '';
  if (icons[1]) icons[1].style.display = on ? '' : 'none';
}

export const syncFullscreenIcon = (on: boolean) => swapIcons('.art-control-dh-fullscreen', on);
export const syncPipIcon = (on: boolean) => swapIcons('.art-control-pip', on);

type WebkitVideo = HTMLVideoElement & {
  webkitDisplayingFullscreen?: boolean;
  webkitEnterFullscreen?: () => void;
  webkitExitFullscreen?: () => void;
};

const ROTATED = 'dh-rotated-fullscreen';
let restoreRotated: (() => void) | null = null;
let orientationLocked = false;

const isMobilePlayer = () =>
  matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|iPod|Mobile|MicroMessenger/i.test(navigator.userAgent);

async function lockLandscape(): Promise<boolean> {
  const orientation = screen.orientation as (ScreenOrientation & { lock?: (value: string) => Promise<void> }) | undefined;
  if (!orientation?.lock) return false;
  try {
    await orientation.lock('landscape');
    orientationLocked = true;
    return true;
  } catch {
    // 内嵌 WebView 常禁止锁定方向，交给 CSS 旋转兜底。
    return false;
  }
}

function unlockLandscape(): void {
  if (!orientationLocked) return;
  screen.orientation?.unlock?.();
  orientationLocked = false;
}

function isRotated(art: ArtplayerType): boolean {
  return art.template.$player.classList.contains(ROTATED);
}

function exitRotated(art: ArtplayerType): void {
  const root = art.template.$player;
  unlockLandscape();
  restoreRotated?.();
  restoreRotated = null;
  root.classList.remove(ROTATED);
  // 让 ArtPlayer 重新量尺寸，否则退出后画面仍是横屏比例。
  window.dispatchEvent(new Event('resize'));
  syncFullscreenIcon(false);
}

function enterRotated(art: ArtplayerType): void {
  const root = art.template.$player;
  const parent = root.parentElement;
  const next = root.nextSibling;
  const cssText = root.style.cssText;
  const bodyOverflow = document.body.style.overflow;

  root.classList.add(ROTATED);
  Object.assign(root.style, {
    position: 'fixed',
    top: '0',
    zIndex: '99999',
    margin: '0',
    transformOrigin: '0 0',
    borderRadius: '0',
  });
  // 竖屏转 90°、横屏直接铺满；横竖屏切换后必须重算，否则画面方向/尺寸会错位
  const applyLayout = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const portrait = h > w;
    Object.assign(root.style, {
      width: `${portrait ? h : w}px`,
      height: `${portrait ? w : h}px`,
      left: portrait ? `${w}px` : '0',
      transform: portrait ? 'rotate(90deg)' : 'none',
    });
  };
  applyLayout();
  window.addEventListener('resize', applyLayout);
  window.addEventListener('orientationchange', applyLayout);
  document.body.style.overflow = 'hidden';
  document.body.appendChild(root);

  restoreRotated = () => {
    window.removeEventListener('resize', applyLayout);
    window.removeEventListener('orientationchange', applyLayout);
    root.style.cssText = cssText;
    if (parent) parent.insertBefore(root, next);
    else document.body.removeChild(root);
    document.body.style.overflow = bodyOverflow;
  };
}

/**
 * 全屏：手机原生全屏优先（真正覆盖状态栏/地址栏），锁横屏失败也保留原生全屏；
 * 桌面保留原生 → 网页全屏 → CSS 旋转兜底。
 */
export async function toggleFullscreen(art: ArtplayerType): Promise<void> {
  const video = art.video as WebkitVideo | null;
  const $player = art.template.$player as HTMLDivElement & {
    webkitRequestFullscreen?: (options?: FullscreenOptions) => Promise<void> | void;
  };
  const options: FullscreenOptions = { navigationUI: 'hide' };
  const requestNative = async () => {
    if ($player.requestFullscreen) return $player.requestFullscreen(options);
    if ($player.webkitRequestFullscreen) return $player.webkitRequestFullscreen(options);
    // 两个进入方法都没有时不能把 `await undefined` 当成成功，否则按钮又成死的
    throw new Error('container fullscreen unavailable');
  };

  // 任何形态的全屏都先退出。
  if (isRotated(art)) {
    exitRotated(art);
    syncFullscreenIcon(false);
    return;
  }
  if (video?.webkitDisplayingFullscreen) {
    video.webkitExitFullscreen?.();
    syncFullscreenIcon(false);
    return;
  }
  if (document.fullscreenElement) {
    await document.exitFullscreen().catch(() => {});
    unlockLandscape();
    syncFullscreenIcon(false);
    return;
  }
  if (art.fullscreenWeb) {
    art.fullscreenWeb = false;
    syncFullscreenIcon(false);
    return;
  }

  if (isMobilePlayer()) {
    // 1) 容器原生全屏：Chrome/Android 上吞掉浏览器 UI；方向锁成功与否都保留它，
    //    不能因为锁失败就退回 CSS 旋转——那样地址栏又露出来了。
    try {
      await requestNative();
      void lockLandscape();
      syncFullscreenIcon(true);
      return;
    } catch {
      /* WebView 不支持容器全屏，继续降 */
    }
    // 2) video 元素的原生全屏：iOS Safari / WKWebView
    if (video && typeof video.requestFullscreen === 'function') {
      try {
        await video.requestFullscreen(options);
        void lockLandscape();
        syncFullscreenIcon(true);
        return;
      } catch {
        /* 继续降 */
      }
    }
    try {
      video?.webkitEnterFullscreen?.();
      if (video?.webkitDisplayingFullscreen) {
        syncFullscreenIcon(true);
        return;
      }
    } catch {
      /* iOS 私有 API 不可用 */
    }
    // 3) 最后兜底：CSS 旋转横屏（无法隐藏浏览器 UI）
    enterRotated(art);
    syncFullscreenIcon(true);
    return;
  }

  // 桌面：容器原生全屏 → 程序化网页全屏 → CSS 旋转兜底
  try {
    await requestNative();
    syncFullscreenIcon(true);
    return;
  } catch {
    /* 继续降级 */
  }
  try {
    art.fullscreenWeb = true;
    syncFullscreenIcon(true);
    return;
  } catch {
    /* 网页全屏不可用 */
  }
  enterRotated(art);
  syncFullscreenIcon(true);
}

/** 小窗：用 ArtPlayer 的 pip 封装（覆盖标准 PiP 与 iOS presentation mode）。 */
export function togglePip(art: ArtplayerType): void {
  const native = (document as Document & { pictureInPictureEnabled?: boolean }).pictureInPictureEnabled;
  const webkitVideo = art.video as (HTMLVideoElement & { webkitSupportsPresentationMode?: boolean }) | null;
  if (!native && !webkitVideo?.webkitSupportsPresentationMode) {
    art.notice.show = '当前浏览器不支持小窗播放，请用系统浏览器打开';
    return;
  }
  try {
    art.pip = !art.pip;
  } catch {
    art.notice.show = '小窗播放启动失败，请确认视频正在播放';
  }
}

/** 控件重建（切换全屏 / resize）后重新同步两枚图标的状态。 */
export function bindControlIconSync(art: ArtplayerType): () => void {
  const full = () => syncFullscreenIcon(Boolean(document.fullscreenElement || art.fullscreenWeb || isRotated(art)));
  const pip = () => syncPipIcon(art.pip);
  art.on('fullscreen', full);
  art.on('fullscreenWeb', full);
  art.on('resize', full);
  art.on('pip', pip);
  const onFullscreenChange = () => {
    if (!document.fullscreenElement) unlockLandscape();
    full();
  };
  document.addEventListener('fullscreenchange', onFullscreenChange);
  window.addEventListener('resize', full);
  return () => {
    art.off('fullscreen', full);
    art.off('fullscreenWeb', full);
    art.off('resize', full);
    art.off('pip', pip);
    document.removeEventListener('fullscreenchange', onFullscreenChange);
    window.removeEventListener('resize', full);
    exitRotated(art);
  };
}
