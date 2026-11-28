import { useEffect, useMemo, useRef, useState } from 'react';
import type ArtplayerType from 'artplayer';
import type HlsType from 'hls.js';
import { buildMediaInfo, resolveArtwork } from '../lib/media-session';
import { useMediaSession } from './use-media-session';
import { useSquareArtwork } from './use-square-artwork';
import {
  bindControlIconSync,
  fullscreenButtonHtml,
  nextIcon,
  pipButtonHtml,
  prevIcon,
  syncFullscreenIcon,
  syncPipIcon,
  toggleFullscreen,
  togglePip,
} from './player-controls';

interface Props {
  url: string;
  /** 同一集的可替换播放地址；依次尝试，界面不暴露具体来源。 */
  fallbackUrls?: string[];
  poster?: string;
  title?: string;
  /** 媒体卡片副标题：点播是集数，直播是分组 */
  subtitle?: string;
  live?: boolean;
  seekTo?: number;
  onProgress?: (seconds: number, duration: number) => void;
  onEnded?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  className?: string;
}

interface ControlOption {
  name: string;
  index: number;
  position: 'left' | 'right';
  html: string;
  tooltip: string;
  click: () => void;
}

const READY_TIMEOUT = 5000;

/** 播放器：ArtPlayer + hls.js 按需加载；失败时短超时快速尝试下一个地址。 */
export function Player({
  url,
  fallbackUrls,
  poster,
  title,
  subtitle,
  live = false,
  seekTo = 0,
  onProgress,
  onEnded,
  onPrev,
  onNext,
  className,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(onProgress);
  const endedRef = useRef(onEnded);
  const prevRef = useRef(onPrev);
  const nextRef = useRef(onNext);
  const seekRef = useRef(seekTo);
  const fallbacksRef = useRef(fallbackUrls || []);
  progressRef.current = onProgress;
  endedRef.current = onEnded;
  prevRef.current = onPrev;
  nextRef.current = onNext;
  seekRef.current = seekTo;
  fallbacksRef.current = fallbackUrls || [];

  // —— 系统媒体卡片：通知栏/锁屏显示片名、集数与封面 ——
  const artRef = useRef<ArtplayerType | null>(null);
  const artwork = useMemo(() => resolveArtwork(poster), [poster]);
  const squareArtwork = useSquareArtwork(artwork);
  const mediaInfo = useMemo(
    () => buildMediaInfo({ title: title || '', subtitle, artwork: squareArtwork }),
    [title, subtitle, squareArtwork]
  );

  const clampSeek = (seconds: number) => {
    const art = artRef.current;
    if (!art || !Number.isFinite(seconds)) return;
    try {
      const duration = Number(art.duration);
      const target =
        Number.isFinite(duration) && duration > 0
          ? Math.min(Math.max(seconds, 0), duration)
          : Math.max(seconds, 0);
      art.currentTime = target;
    } catch {
      /* 播放器还未就绪 */
    }
  };

  const mediaSession = useMediaSession({
    info: mediaInfo,
    canSeek: !live,
    canPrev: Boolean(onPrev),
    canNext: Boolean(onNext),
    actions: {
      // ArtPlayer 的 play() 返回 Promise：锁屏点播放被浏览器拒绝时不能冒泡成未处理拒绝。
      play: () => Promise.resolve(artRef.current?.play()).catch(() => {}),
      pause: () => {
        try {
          artRef.current?.pause();
        } catch {
          /* 忽略 */
        }
      },
      seekTo: clampSeek,
      seekBy: (delta) => {
        const current = Number(artRef.current?.currentTime);
        clampSeek((Number.isFinite(current) ? current : 0) + delta);
      },
      prev: () => prevRef.current?.(),
      next: () => nextRef.current?.(),
    },
  });

  const [attemptState, setAttemptState] = useState({ url, attempt: 0 });
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const attempt = attemptState.url === url ? attemptState.attempt : 0;

  useEffect(() => setFailed(false), [url]);
  useEffect(() => setReady(false), [url, attempt]);

  useEffect(() => {
    let disposed = false;
    let ready = false;
    let advanced = false;
    let player: ArtplayerType | null = null;
    let instance: HlsType | null = null;
    let cleanup: (() => void) | null = null;

    void (async () => {
      const [{ default: Artplayer }, { default: Hls }] = await Promise.all([
        import('artplayer'),
        import('hls.js'),
      ]);
      if (disposed || !mountRef.current) return;

      const candidates = [url, ...fallbacksRef.current].filter((u, i, all) => u && all.indexOf(u) === i);
      const current = candidates[Math.min(attempt, candidates.length - 1)];
      let timer = 0;

      // 失败一次只推进一次：HLS 的 fatal error 与 video error 可能同时到达。
      const advance = () => {
        if (disposed || ready || advanced) return;
        advanced = true;
        if (attempt + 1 >= candidates.length) {
          setFailed(true);
          return;
        }
        setAttemptState({ url, attempt: attempt + 1 });
      };

      const controls: ControlOption[] = [];
      if (prevRef.current) {
        controls.push({ name: 'prev-episode', index: 11, position: 'left', html: prevIcon, tooltip: '上一集', click: () => prevRef.current?.() });
      }
      if (nextRef.current) {
        controls.push({ name: 'next-episode', index: 12, position: 'left', html: nextIcon, tooltip: '下一集', click: () => nextRef.current?.() });
      }
      controls.push({ name: 'pip', index: 40, position: 'right', html: pipButtonHtml, tooltip: '小窗播放', click: () => togglePip(art!) });
      // 用独立名字，避免被 ArtPlayer 内置的 fullscreen 控件覆盖（内置按钮在部分内核上点了没反应）。
      controls.push({
        name: 'dh-fullscreen',
        index: 70,
        position: 'right',
        html: fullscreenButtonHtml,
        tooltip: '全屏',
        click: () => {
          void toggleFullscreen(art!);
        },
      });

      const isHls = /\.m3u8(\?|$)/i.test(current);
      let lastSaved = -1;

      // 控件的 click 在实例创建后才触发，art 此时已被赋值。
      let art: ArtplayerType = new Artplayer({
        container: mountRef.current,
        url: current,
        poster: poster || '',
        theme: '#ffb454',
        isLive: live,
        // 非 HLS 时不能传 type: undefined——ArtPlayer 的参数校验会直接抛错。
        ...(isHls
          ? {
              type: 'customHls',
              customType: {
                // 自定义 type 下播放地址在第二个参数里，ArtPlayer 不会给 video.src 赋值。
                customHls(video: HTMLVideoElement, sourceUrl: string) {
                  instance = new Hls({ enableWorker: true, lowLatencyMode: live });
                  instance.on(Hls.Events.ERROR, (_event, data) => {
                    if (data.fatal) advance();
                  });
                  instance.loadSource(sourceUrl || video.src);
                  instance.attachMedia(video);
                },
              },
            }
          : {}),
        setting: false,
        fullscreen: false,
        fullscreenWeb: false,
        pip: false,
        hotkey: true,
        autoplay: false,
        playsInline: true,
        controls,
      });
      player = art;
      artRef.current = art;

      const syncPosition = () => {
        if (live) return; // 直播 duration 是 Infinity，别写进度
        const rate = typeof art.video?.playbackRate === 'number' ? art.video.playbackRate : 1;
        mediaSession.updatePosition(art.currentTime, art.duration, rate);
      };
      const onPlaying = () => {
        mediaSession.setPlaybackState('playing');
        syncPosition();
      };
      const onPause = () => {
        mediaSession.setPlaybackState('paused');
        syncPosition();
      };

      const unbindSync = bindControlIconSync(art);
      syncFullscreenIcon(false);
      syncPipIcon(false);

      timer = window.setTimeout(advance, READY_TIMEOUT);
      art.on('ready', () => {
        ready = true;
        setReady(true);
        window.clearTimeout(timer);
        const target = seekRef.current;
        if (!live && target > 1 && target < art.duration - 5) art.currentTime = target;
      });
      art.on('error', advance);
      art.on('video:error', advance);
      art.on('timeupdate', () => {
        if (!art || live || !progressRef.current) return;
        const seconds = Math.floor(art.currentTime);
        if (seconds !== lastSaved && seconds % 5 === 0) {
          lastSaved = seconds;
          progressRef.current(seconds, art.duration);
        }
      });
      art.on('ended', () => endedRef.current?.());
      art.on('pause', () => {
        if (art && !live) progressRef.current?.(art.currentTime, art.duration);
      });
      art.on('video:playing', onPlaying);
      art.on('video:pause', onPause);
      art.on('video:seeked', syncPosition);
      art.on('video:timeupdate', syncPosition);
      art.on('video:ratechange', syncPosition);

      cleanup = () => {
        window.clearTimeout(timer);
        unbindSync();
        art.off('video:playing', onPlaying);
        art.off('video:pause', onPause);
        art.off('video:seeked', syncPosition);
        art.off('video:timeupdate', syncPosition);
        art.off('video:ratechange', syncPosition);
        if (artRef.current === art) artRef.current = null;
      };
      if (disposed) cleanup();
    })();

    return () => {
      disposed = true;
      cleanup?.();
      try {
        instance?.destroy();
        player?.destroy(true);
      } catch {
        /* 播放器已销毁 */
      }
    };
  }, [url, attempt, poster, title, live, mediaSession]);

  const retry = () => {
    setFailed(false);
    setAttemptState({ url, attempt: 0 });
  };

  return (
    <div className={`player-box ${className || ''}`}>
      <div ref={mountRef} className="player-mount" />
      {attempt > 0 && !failed && !ready && (
        <div className="player-status" aria-live="polite">
          <span className="spinner" />
          <span>正在切换线路…</span>
        </div>
      )}
      {failed && (
        <div className="player-status">
          <span>视频加载失败</span>
          <button className="btn small" onClick={retry}>重试</button>
        </div>
      )}
    </div>
  );
}
