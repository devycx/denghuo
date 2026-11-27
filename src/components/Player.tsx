import { useEffect, useRef, useState } from 'react';
import type ArtplayerType from 'artplayer';
import type HlsType from 'hls.js';
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

      cleanup = () => {
        window.clearTimeout(timer);
        unbindSync();
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
  }, [url, attempt, poster, title, live]);

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
