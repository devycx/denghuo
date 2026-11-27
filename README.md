# 灯火影视

> 原创实现、自主可控的轻量视频聚合播放站。基于 Cloudflare 免费资源，单 Worker 同时承载 API、静态前端与边缘缓存。
> 架构采用 **Hono（约 20k★，Cloudflare 官方合作维护的 Workers 路由层）+ `@cloudflare/vite-plugin`（官方 Vite 集成）**，MIT 许可。

灯火影视**不是**夜幕影视（LibreTV）的二开或移植：代码从零编写，不引入其依赖、配置或 AGPL 授权内容。它只保留了那类站点真正好用的产品思路，其余全部重写或删掉。

---

## 一、取精去粗

| 从夜幕影视吸取的「精」 | 灯火影视的实现 |
|---|---|
| 苹果 CMS / mgdb 多源聚合搜索 | `worker/cms.ts` 原创解析器，`POST /api/search` 并行请求、按片名+年份去重、相关性排序 |
| 换源 / 多线路分集 | `POST /api/detail/multi` 按片名在其它源找同片，一次最多 8 源 |
| M3U 直播订阅、跨源频道合并 | `worker/live.ts` 原创解析与合并，点频道才探测（按需，0 请求起步） |
| 边缘缓存压低上游压力 | `worker/cache.ts` 直接用 Cloudflare Cache API，搜索 3 分钟 / 详情 10 分钟 / 封面 1 天 |
| SSRF 防护、 Workers 子请求预算意识 | `worker/ssrf.ts` 协议白名单 + 内网拦截；所有并发都有硬上限 |
| 收藏 / 观看记录 / 进度 | 仅存 localStorage，无后端数据库、无账号体系 |

| 丢掉的「粗」 | 为什么 |
|---|---|
| Next.js + OpenNext 构建链（~1.5 分钟、大量依赖） | 换成 Vite + Hono + 官方 Vite 插件，构建秒级，部署只有一个 Worker |
| 自研路由、双进程 dev + proxy 这种拼凑做法 | 改用 Hono（20k★）与 `@cloudflare/vite-plugin`：一个 dev server 同时跑前后端，API 与页面同域 |
| 100+ 个 lib 文件、700+ 单测、层层抽象 | 收敛到 8 个 Worker 模块 + 4 个测试文件，改起来不用先读三份交接文档 |
| Dexie/IndexedDB、TanStack Query/Virtual、zustand | 浏览器原生 localStorage + React 内置 state，够用且透明 |
| AGPL-3.0 与预置 20 个源（含成人源） | MIT；默认只放一组公开的非成人源，成人源由你自己决定要不要加 |
| 豆瓣 / Bangumi / 热榜 / 订阅同步等外部依赖 | 全部去掉。首页只做「最新收录」，冷数据靠 Cron + 边缘缓存 |
| Cloudflare Access 门禁、密码弹窗、主题分级等历史包袱 | 去掉。公开模式开箱即用，配置管理用 KV + Bearer Token |
| 油猴脚本 / GM_fetch 硬依赖 | 不需要。前端请求的都是同源 `/api/*`，Worker 负责取数 |

---

## 二、利用了哪些 Cloudflare 免费能力

| 能力 | 用途 | 免费额度内的做法 |
|---|---|---|
| **Workers** | 全部 API + 静态资源托管 | 一个 Worker，无容器、无 Node 服务器 |
| **Workers Assets** | 托管 Vite 产物 | 同域部署，无 CORS 问题 |
| **Cache API** | 搜索 / 详情 / 封面 / 直播列表边缘缓存 | 命中不产生上游请求；`void cache.put()` 异步回填 |
| **Workers KV** | 在线修改点播源与直播源 | 可选绑定；未绑定时自动回退 `wrangler.toml` 默认配置 |
| **Cron Triggers** | 每 30 分钟预热首页 | 第一个访客直接命中缓存 |
| **Workers Observability** | 请求日志与异常排查 | `wrangler.toml` 已开启 |

刻意避开：Durable Objects / R2 / Queues / Analytics Engine。对这个规模的应用它们只会增加成本和复杂度。

---

## 三、目录结构

```
denghuo/
├── worker/                 # Cloudflare Worker（TypeScript，Web 标准，无 Node API）
│   ├── index.ts            # fetch / scheduled 入口
│   ├── app.ts              # Hono 应用：CORS 中间件 + 路由注册
│   ├── adapter.ts          # Hono Context → 纯函数 handler 适配层
│   ├── config.ts           # KV + vars 配置回退
│   ├── cache.ts            # Cache API 封装
│   ├── ssrf.ts             # 上游地址校验
│   ├── cms.ts              # 苹果 CMS 解析 / 去重 / 相关性
│   ├── live.ts             # M3U 解析 / 频道合并
│   ├── http.ts             # JSON、超时 fetch、地址拼接
│   ├── routes/             # config / search / detail / live / image / admin
│   └── *.test.ts           # 跑在 Workers runtime（miniflare）里的单测
├── src/                    # React 前端（哈希路由，无 react-router）
│   ├── api.ts / store.tsx / router.ts
│   ├── components/         # Header / VideoCard / Player / Toast / States
│   └── pages/              # Home / Search / Detail / Watch / Live / Library / Settings
├── public/                 # PWA manifest + 图标
├── wrangler.toml
└── .github/workflows/      # ci + deploy
```

`Player` 按需动态加载 ArtPlayer + hls.js，首屏不下载播放器代码。

---

仓库：https://github.com/devycx/denghuo （public，MIT）。push `main` → `ci`（typecheck / 11 单测 / build）→ `deploy`（wrangler deploy）自动发布。

---

## 架构选型说明

为什么不复用夜幕影视的 Next.js + OpenNext：

- **取数架构没变**：所有上游请求仍在服务端 Worker 里。当初夜幕影视回滚，是因为把取数搬到了浏览器（GM_fetch 硬依赖），灯火影视没有走那条路。
- **这层的标准件是 Hono，不是 Next.js**：Hono 约 20k★，与 Cloudflare 合作维护，是 Workers 生态的路由事实标准；而 Next.js 的 CF 适配器 OpenNext 只有约 1.5k★。
- **构建层用官方插件**：`@cloudflare/vite-plugin` 是 Cloudflare 官方维护的 Vite 集成，一个 dev server 同时跑前后端，构建产物直接被 `wrangler deploy` 识别。
- **没有 SSR/SEO 需求**：视频聚合站首屏是数据驱动的，SPA + 服务端 API 足够；为不存在的 SSR 需求付 1.5 分钟构建和几百个依赖不划算。
- **迁移成本低**：`worker/routes/*` 都是纯函数（`RouteContext → Response`），将来真要上 Next.js，把它们包成 `route.ts` 即可。

---

## 四、快速开始

环境：Node 22+（wrangler 要求；本机已知可用 `C:\Users\ycx\tools\node-v24.22.3`）。

```powershell
cd C:\Users\ycx\Documents\OpenCodeProject\denghuo
npm install
npm run dev        # 一个 Vite 进程同时跑前端 + Worker（localhost:5173，API 同域）
```

打开 `http://localhost:5173`。本地 API 默认读 `wrangler.toml` 的 `DEFAULT_SOURCES`；先把占位源换成你自己的苹果 CMS 接口。

```powershell
npm run typecheck  # 前端 + Worker 两套 tsconfig
npm test           # 11 条单测，跑在 Workers runtime 中（Hono 路由 / CMS / SSRF / 直播）
npm run build      # → dist/client（前端）+ dist/worker（Worker + 输出 wrangler.json）
npm run preview    # 在 Workers runtime 里预览构建产物
```

---

## 五、部署

### 当前线上状态（2026-11-27 已发布）

| 项 | 值 |
|---|---|
| 域名 | https://denghuo.ycxdev.com |
| Worker | `denghuo`，当前 Version ID `a77a77cc-f2f1-4081-ade9-cb77ecd19c46` |
| KV | `denghuo-config` → `723ab269584b4019aceda1d81a91761a`（绑定 `CONFIG_KV`） |
| Secret | `ADMIN_PASSWORD` 已上传；本地值见 `.dev.vars`（已 gitignore） |
| Cron | `*/30 * * * *` 预热首页 |
| 实测 | 搜索 29 条真实结果 / 直播 11720 频道 / 封面代理 200 / 管理接口读写正常 |

### 从零复现

1. 登录 Cloudflare：`npx wrangler login`
2. 创建 KV（可选但推荐）：
   ```powershell
   npx wrangler kv namespace create DENGHUO_CONFIG
   ```
   把返回的 id 填进 `wrangler.toml` 里 `[[kv_namespaces]]` 并取消注释。
3. 管理员密码（只用 secret，不进仓库）：
   ```powershell
   npx wrangler secret put ADMIN_PASSWORD
   ```
4. 自定义域名：在 Cloudflare DNS 把 `denghuo.ycxdev.com` 指向 Worker，取消 `[[routes]]` 注释。不配也能用 `denghuo.<subdomain>.workers.dev`。
5. 部署：
   ```powershell
   npm run deploy      # build + wrangler deploy
   npx wrangler tail   # 看实时日志
   ```

GitHub Actions 已配置：`CLOUDFLARE_API_TOKEN`（`github-actions-denghuo-deploy`，权限 Workers 脚本/KV 编辑）与 `CLOUDFLARE_ACCOUNT_ID` 已写入仓库 Secrets；push `main` 后 `ci` → `deploy` 自动发布，实测全绿。

> 常规发布走 CI；本地 `wrangler deploy` 只用于预览/热修复/回滚。
> 用 `gh secret set --body` 写 secrets，PowerShell 管道会带尾部换行导致 account id 校验失败。

---

## 六、配置源

在「设置 → 数据源管理」里编辑 JSON，或在 `wrangler.toml` 改默认值：

```json
[
  { "key": "a", "name": "资源站 A", "url": "https://example.com/api.php/provide/vod", "isAdult": false, "tier": 1 }
]
```

直播源是 M3U 订阅：

```json
[
  { "key": "iptv", "name": "iptv-org 全球", "url": "https://iptv-org.github.io/iptv/index.m3u" }
]
```

源地址必须是公网 `http(s)`；内网地址会被 SSRF 校验拦截。管理接口保存后，边缘缓存会在 TTL（最多 10 分钟）后自然刷新。

---

## 七、API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 健康检查 |
| GET | `/api/config` | 公开配置（站点名、源列表、KV 状态） |
| GET | `/api/home` | 首页推荐行（缓存 10 分钟） |
| POST | `/api/search` | `{ wd, sources?, filterAdult? }` 多源聚合搜索 |
| GET | `/api/detail?source=&id=` | 单个源详情与分集 |
| POST | `/api/detail/multi` | `{ title, sources? }` 跨源换源 |
| GET | `/api/live/channels` | 聚合频道列表（缓存 5 分钟） |
| GET | `/api/live/probe?urls=a,b,c` | 最多 8 个直播地址按需探测（4 并发） |
| GET | `/api/image?url=` | 封面代理（缓存 1 天） |
| GET | `/api/admin/status` | KV / 密码状态 |
| POST | `/api/admin/config` | Bearer 密码保存源配置 |

所有响应带 CORS 头，`OPTIONS` 预检已处理。

---

## 八、许可

MIT License。项目中的解析器、路由、播放器封装、UI 均为原创实现；运行时依赖（React、ArtPlayer、hls.js）各自遵循其上游许可。不包含任何 AGPL 项目的代码。
