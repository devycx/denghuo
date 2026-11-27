import { useEffect, useRef } from 'react';
import type ArtplayerType from 'artplayer';

interface Props {
  url: string;
  poster?: string;
  title?: string;
  live?: boolean;
  seekTo?: number;
  onProgress?: (seconds: number, duration: number) => void;
  onEnded?: () => void;
  className?: string;
}

/** 播放器：ArtPlayer + hls.js 按需加载，直播模式隐藏进度条。 */
export function Player({ url, poster, title, live = false, seekTo = 0, onProgress, onEnded, className }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(onProgress);
  const endedRef = useRef(onEnded);
  const seekRef = useRef(seekTo);
  progressRef.current = onProgress;
  endedRef.current = onEnded;
  seekRef.current = seekTo;

  useEffect(() => {
    let disposed = false;
    let player: ArtplayerType | null = null;
    let hls: { destroy: () => void } | null = null;

    void (async () => {
      const [{ default: Artplayer }, { default: Hls }] = await Promise.all([
        import('artplayer'),
        import('hls.js'),
      ]);
      if (disposed || !boxRef.current) return;

      const isHls = /\.m3u8(\?|$)/i.test(url);
      let lastSaved = -1;

      player = new Artplayer({
        container: boxRef.current,
        url,
        poster: poster || '',
        theme: '#ffb454',
        isLive: live,
        type: isHls ? 'customHls' : undefined,
        customType: isHls
          ? {
              // ArtPlayer 的 customType 回调签名是 (video, url, art)；使用自定义 type 时
              // 它不会给 video.src 赋值，真正的播放地址在第二个参数里。
              customHls(video: HTMLVideoElement, sourceUrl: string) {
                const instance = new Hls({ enableWorker: true, lowLatencyMode: live });
                hls = instance;
                instance.loadSource(sourceUrl || video.src);
                instance.attachMedia(video);
              },
            }
          : undefined,
        setting: true,
        fullscreen: true,
        pip: true,
        hotkey: true,
        autoplay: false,
      });

      player.on('ready', () => {
        const target = seekRef.current;
        if (!live && player && target > 1 && target < player.duration - 5) {
          player.currentTime = target;
        }
      });
      player.on('timeupdate', () => {
        if (!player || live || !progressRef.current) return;
        const current = Math.floor(player.currentTime);
        if (current !== lastSaved && current % 5 === 0) {
          lastSaved = current;
          progressRef.current(current, player.duration);
        }
      });
      player.on('ended', () => endedRef.current?.());
      player.on('pause', () => {
        if (player && !live) progressRef.current?.(player.currentTime, player.duration);
      });
    })();

    return () => {
      disposed = true;
      try {
        hls?.destroy();
        player?.destroy(true);
      } catch {
        /* 播放器已销毁 */
      }
    };
  }, [url, poster, title, live]);

  return <div ref={boxRef} className={`player-box ${className || ''}`} />;
}
