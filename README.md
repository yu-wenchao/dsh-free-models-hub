# dsh-free-models-hub

[English](#english) · [简体中文](#简体中文)

<a id="简体中文"></a>

## 免费模型排行榜 · DeepSeek Harness 社区插件

在 DeepSeek Harness (DSH) Web UI **右侧边缘**提供「免费模型榜」抽屉面板：分页浏览免费模型，
点击标题展开 **API 调用地址 / 模型名称 / 【点击这里申请免费密钥key】按钮**，
支持**一键配置** / **整页批量配置** 到 `设置 → 模型 → 自定义提供方` —— 用户只需自行粘贴免费 API Key。
支持**多 Key 轮换**：同一模型粘贴多条免费 Key，由本地代理自动轮询，一个 Key 失效自动换下一个。

数据由你自己的站点维护：内置 **PHP 7.4 + SQLite** 管理后台（单管理员、手工录入），
插件通过只读 JSON API 拉取。**插件全程不接触用户 Key**（Key 只走 DSH 官方凭据通道）。

```
┌──────────────────────────┐
│ 🎁 免费模型榜         ▾  │   ← DSH 窗口右侧边缘的悬浮抽屉面板
├──────────────────────────┤
│ [📖 使用教程]            │   ← 三步引导：配置 → 填 Key → 使用
│ 1. GLM-5-Flash 免费额度 ›│
│   ├ API 地址 https://…   │
│   ├ 模型名 glm-5-flash   │
│   ├ [🔑 申请免费密钥key] │
│   └ [⚡ 一键配置到 DSH]   │
│ 2. Kimi K2 Free          │
│ 首页 < 1 [2] 3 … 9 > 末页│
│ [⚡ 配置本页全部] [🔄 刷新]│   ← 批量配置 / 多Key轮换
├──────────────────────────┤
│ 技术笔记·插件开发·联系站长│
└──────────────────────────┘
```

## 安装

```bash
dsh plugin --profile web add github:yu-wenchao/dsh-free-models-hub
```

- 桌面版：在 DSH 的 **设置 → 插件中心 / 插件配置** 里添加 `dsh-free-models-hub`。
- **预构建产物随仓库分发**，安装过程**不会触发 pnpm allowBuilds 构建许可**。
- 固定版本：`dsh plugin --profile web add github:yu-wenchao/dsh-free-models-hub#v0.3.1`
- 更新：再次执行同一条 add 命令即可；卸载：`dsh plugin --profile web remove dsh-free-models-hub`

## 使用

### 数据源

面板默认已连接**插件作者运营的官方数据源**（`https://free-api.gd7.cn`），**安装即可用，无需任何配置**。
后台与数据库仅作者持有，不随仓库分发；普通用户无法也无需自建数据源。

### 用户侧（DSH 内）

1. 安装并重启后，DSH 窗口**右侧边缘出现 🎁 圆形按钮** → 点击展开「免费模型榜」抽屉面板（再点收起，Esc 也可关闭）。
2. 面板顶部可展开 **📖 使用教程**，按三步指引操作；也可直接：
   - 点一条模型展开 → 点「🔑 点击这里申请免费密钥key」去第三方平台注册拿 Key；
   - 点「⚡ 一键配置到 DSH」把该模型提供方写入 `设置 → 模型`；
   - 或点「⚡ 配置本页全部」**一键批量写入本页全部模型**。
3. 到 **设置 → 模型** 找到 `freehub-*` 提供方，**把 Key 粘贴到「API Key」框并保存** —— 模型立即可用。
   - 若报「no credential」或「API key is invalid」，回到提供方重新粘贴一次并保存。
4. **多 Key 轮换（可选）**：在同一模型上点「🔄 多 Key 轮换」，把多条免费 Key 每行一个粘贴保存，
   本地代理（默认端口 `8787`）会自动轮询；某条 Key 失效自动换下一条。
5. 回到聊天页，在顶部模型选择器切换到该提供方下的模型（如 `glm-5.2`、`deepseek-v4-flash`）即可免费对话。

> 提供方写入**全程通过 DSH 官方 `settingsScope` 完成**，由 DSH 自行持久化到 `settings.yaml`，
> 插件**不直接改写 `settings.yaml`**，不会损坏该文件，也不会覆盖你已有的其他提供方。

## 配置（cordis.patch.yml 覆盖 `free-models-hub` 行；也可在 DSH 设置的插件页里改）

| 键 | 默认 | 说明 |
|---|---|---|
| `backendUrl` | `''` | 数据源接口地址（留空则用作者运营的 `https://free-api.gd7.cn`；也可面板内填写） |
| `pageSize` | `20` | 每页条数（服务端钳制 1–50） |
| `requestTimeoutMs` | `10000` | 拉取超时（1000–60000） |
| `uiSlot` | `''` | 注入的侧边栏 slot；**留空默认使用右侧边缘抽屉面板**（所有 DSH 构建一致） |
| `providerIdPrefix` | `freehub` | 生成的 Provider ID 前缀（形如 `freehub-glm-5`） |
| `proxyPort` | `8787` | 本地多 Key 轮换代理端口（仅 127.0.0.1） |
| `footerLinks` | 三条固定菜单 | 底部菜单 `{label,url}` 数组（最多 6 条） |
| `debug` | `false` | 是否输出详细日志 |

## 功能特性

- **右侧边缘抽屉面板**：独立的 🎁 开关按钮 + 滑入式面板，不依赖 DSH 内部侧边栏布局，兼容性稳定；开合状态与教程展开状态都会持久化。
- **一键配置 / 批量配置**：单条一键写入，或「配置本页全部」一键批量写入整页模型到 `设置 → 模型`。
- **首次使用教程**：面板内置三步引导（配置 → 填 Key → 使用），新用户无需猜测。
- **多 Key 轮换代理**：本地代理为池内提供方自动轮询 API Key；DSH 凭据校验所需的占位环境变量由插件在启动时自动补齐。
- **分页与排序**：服务端分页（首页/末页/页码窗口），标题升序排列，结果稳定可预期。

## 安全特性

- 用户 API Key **全程不经过本插件任何一端**（只走 DSH 官方 write-only 凭据通道）；
- 面板渲染全部走安全 DOM API（无 innerHTML）；外链 `noopener noreferrer`；URL 仅接受 http/https；
- 提供方设置写入只用 DSH 官方 `settingsScope`，**不直接改 `settings.yaml`**，杜绝文件损坏；
- 后端单入口路由：全站干净 URL（`/`、`/api/models`、`/admin`），`.php` 直连 301/404，
  无 `X-Powered-By` 指纹——技术栈对用户不可见；
- 后台：bcrypt + CSRF + 登录限速 + 会话加固；SQL 全部预编译；数据目录 deny-all；
  详细威胁建模与验收矩阵见 [`docs/05-安全审查与验收.md`](docs/05-安全审查与验收.md)。

## 文档

| 文档 | 内容 |
|---|---|
| [`docs/01-策划书.md`](docs/01-策划书.md) | 产品定位、功能规格、原型 |
| [`docs/02-技术方案.md`](docs/02-技术方案.md) | 架构、bundle/client 规范、风险登记 |
| [`docs/03-开发计划.md`](docs/03-开发计划.md) | 里程碑与流程约定 |
| [`docs/04-代码审查清单.md`](docs/04-代码审查清单.md) | PR 审查清单 |
| [`docs/05-安全审查与验收.md`](docs/05-安全审查与验收.md) | 威胁建模、安全/功能验收矩阵 |
| [`docs/06-发布与升级指南.md`](docs/06-发布与升级指南.md) | GitHub topics、发版、市场更新 |
| [`docs/07-修复清单.md`](docs/07-修复清单.md) | 已知问题、根因分析与修复记录 |

## 开发

```bash
npm run build    # regenerate lib/ from src/
npm run verify   # CI check: lib/ in sync with src/
npm test         # node --test unit tests (33)
php -l server-php/**/*.php   # PHP syntax gate (PHP >= 7.4)
```

## License

[MIT](LICENSE)

---

<a id="english"></a>

## Free Models Leaderboard — a community plugin for DeepSeek Harness

A "Free Models" drawer panel for the DSH web UI, toggled by a 🎁 button on the right edge of the window.
Expand a row to see the API base URL, model name and an **"apply for your free key"** button linking to the
publisher's signup page; then **one-click**, or **batch one-click across the whole page**, write the custom
provider into `Settings → Models` — you only paste your free API key afterwards. A built-in
**multi-key rotation proxy** auto-cycles several free keys on the same model, falling over to the next key
when one is exhausted.

The list is served by the **author-operated backend** (`https://free-api.gd7.cn`, PHP 7.4 + SQLite);
the backend is a private component and is not distributed with this repository.
The plugin never sees your API keys — it works out of the box right after install.

```bash
dsh plugin --profile web add github:yu-wenchao/dsh-free-models-hub
```

Provider writes go exclusively through DSH's official `settingsScope` (never editing `settings.yaml`
directly), so existing providers are never wiped and no config file corruption can occur. A collapsible
in-panel tutorial walks first-time users through configure → paste key → use.

Prebuilt artifacts are committed, so installation never asks for pnpm build-script permissions.
See the Chinese sections above for full docs; the security review and acceptance matrices live under
[`docs/`](docs/).

<!-- dsh-plugin.org listing badge (replace owner/slug with your detail-page path when listed) -->
[![Listed on dsh-plugin.org](https://dsh-plugin.org/badges/listed.svg)](https://dsh-plugin.org/plugins/yu-wenchao/dsh-free-models-hub)
