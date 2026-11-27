# 灯火影视

灯火影视是一个基于 Cloudflare 免费资源的轻量视频聚合播放站，用 Hono Worker 同时承载多源搜索 API、React 前端和边缘缓存。

```mermaid
flowchart LR
  U[浏览器 · React SPA] -->|同源 /api/*| W[Cloudflare Worker · Hono 路由]
  W --> C[Cache API<br/>搜索 / 详情 / 封面 / 直播]
  W --> KV[(Workers KV<br/>源配置)]
  W --> SSRF[SSRF 校验]
  SSRF --> UP[苹果 CMS / M3U 源站]
  W --> A[Workers Assets<br/>静态资源]
  U --> P[ArtPlayer + hls.js<br/>直连源站播放]
  CRON[Cron 每 30 分钟预热] --> C
```
