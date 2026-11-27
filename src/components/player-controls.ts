import type ArtplayerType from 'artplayer';

/**
 * 播放器控件（参考夜幕影视的产品思路，原创实现）：
 * - 全屏按钮用 ArtPlayer 风格的实心图标，进入/退出两枚随状态切换；
 * - 点击走「原生全屏 → iOS 视频全屏 → 网页全屏 → 旋转横屏」降级链，手机不被系统旋转锁卡住；
 * - 小窗按钮与上一集/下一集按钮作为自定义控件注册进 ArtPlayer 控制条。
 */

const fullscreenEnter = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 1024 1024" style="fill:currentColor;overflow:visible"><path d="M625 256h142v142h114V142H625v114zM256 398V256h142V142H142v256h114zM768 626v142H626v114h256V626H768zM398 768H256V626H142v256h256V768z"/></svg>`;
const fullscreenExit = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 1024 1024" style="fill:currentColor;overflow:visible;display:none"><path d="M768 299h171v85H683V128h85v171zM341 384H128v-85h171V128h85v256zM768 725v-85H683v256h85V725zM341 640H128v85h171v171h85V640z"/></svg>`;

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
    left: '50%',
    top: '50%',
    zIndex: '99999',
    width: `${window.innerHeight}px`,
    height: `${window.innerWidth}px`,
    transform: 'translate(-50%, -50%) rotate(90deg)',
    transformOrigin: 'center center',
    borderRadius: '0',
  });
  document.body.style.overflow = 'hidden';
  document.body.appendChild(root);

  restoreRotated = () => {
    root.style.cssText = cssText;
    if (parent) parent.insertBefore(root, next);
    else document.body.removeChild(root);
    document.body.style.overflow = bodyOverflow;
  };
}

/** 全屏：手机进入时直接横屏（锁方向失败则 CSS 旋转），桌面保留原生 → 网页全屏降级链。 */
export async function toggleFullscreen(art: ArtplayerType): Promise<void> {
  const video = art.video as WebkitVideo | null;

  // 任何形态的全屏都先退出。
  if (isRotated(art)) {
    exitRotated(art);
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
  if (video?.webkitDisplayingFullscreen) {
    video.webkitExitFullscreen?.();
    syncFullscreenIcon(false);
    return;
  }

  if (isMobilePlayer()) {
    try {
      await art.template.$player.requestFullscreen();
      if (await lockLandscape()) {
        syncFullscreenIcon(true);
        return;
      }
      // 锁方向失败时原生全屏仍是竖屏，退回 CSS 旋转横屏。
      await document.exitFullscreen().catch(() => {});
      enterRotated(art);
      syncFullscreenIcon(true);
      return;
    } catch {
      /* WebView 不支持容器全屏，继续走 iOS / 旋转兜底 */
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
    enterRotated(art);
    syncFullscreenIcon(true);
    return;
  }

  try {
    await art.template.$player.requestFullscreen();
    syncFullscreenIcon(true);
    return;
  } catch {
    /* 桌面浏览器不支持，继续降级 */
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
  if (!native && !webkitVideo?.webkitSupportsPresentationMode) return;
  try {
    art.pip = !art.pip;
  } catch {
    /* 不支持时保持原状 */
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
