# dsh-free-models-hub

[English](#english) · [简体中文](#简体中文)

<a id="简体中文"></a>

## 免费模型排行榜 · DeepSeek Harness 社区插件

在 DeepSeek Harness (DSH) Web UI 左侧边栏提供「免费模型榜」：分页浏览（每页 10 条、页码窗口、首页/末页）、
点击标题展开 **API 调用地址 / 模型名称 / 【点击这里申请免费密钥key】按钮**，
并支持**一键配置**到 设置 → 模型 → 自定义提供方 —— 用户只需自行粘贴免费 API Key。

数据由你自己的站点维护：内置 **PHP 7.4 + SQLite** 管理后台（单管理员、手工录入），
插件通过只读 JSON API 拉取。插件全程不接触用户 Key。

```
┌──────────────────────────┐
│ 🎁 免费模型榜         ▾  │
├──────────────────────────┤
│ 1. GLM-5-Flash 免费额度 ›│
│   ┌────────────────────┐ │
│   │ API 地址 https://… │ │
│   │ 模型名 glm-5-flash │ │
│   │ [申请免费密钥key]   │ │
│   │ [⚡ 一键配置到 DSH]  │ │
│   └────────────────────┘ │
│ 2. Kimi K2 Free          │
│ 首页 < 1 [2] 3 … 9 > 末页│
├──────────────────────────┤
│ 技术笔记·插件开发·联系站长│ ← http://blog.4wc.cn · https://blog.gd7.cn/ · http://web.yu-wenchao.cn/
└──────────────────────────┘
```

## 安装

```bash
dsh plugin add github:yu-wenchao/dsh-free-models-hub
```

- 预构建产物随仓库分发，安装过程**不会触发 pnpm allowBuilds 构建许可**。
- 固定版本：`dsh plugin add github:yu-wenchao/dsh-free-models-hub#v0.1.0`
- 更新：再次执行同一条 add 命令即可；卸载：`dsh plugin --profile <name> remove dsh-free-models-hub`

## 使用

### 数据源

面板默认已连接**插件作者运营的官方数据源**（`https://free-api.gd7.cn`），安装即可用，无需任何配置。
后台与数据库仅作者持有，不随仓库分发；普通用户无法也无需自建数据源。

### 用户侧（DSH 内）

1. 安装后打开左侧「免费模型榜」面板——数据已自动加载。
   （如作者更换数据源地址，面板内「配置数据源」填新域名根即可。）
2. 点击标题展开 → 点「点击这里申请免费密钥key」去第三方平台注册拿 Key。
3. 点「⚡ 一键配置到 DSH」→ 到 **设置 → 模型** 找到 `freehub-*` 提供方，粘贴你的 Key 即可。
   - 若当前 DSH 版本不支持自动写入，会弹出 YAML 引导弹窗（一键复制），手动粘进
     `$DSH_HOME/settings.yaml` 效果相同。

> 作者的站点本身就是公开榜单页：浏览器打开数据源域名可看到同样的排行榜；
> `/admin` 是作者专属后台。全站干净 URL——`.php`、数据库等技术栈痕迹对用户完全不可见。

## 配置（cordis.patch.yml 覆盖 `free-models-hub` 行）

| 键 | 默认 | 说明 |
|---|---|---|
| `backendUrl` | `''` | 数据源接口地址（也可面板内填写） |
| `pageSize` | `10` | 每页条数（服务端钳制 1–50） |
| `requestTimeoutMs` | `10000` | 拉取超时 |
| `uiSlot` | `sidebar.workspaces` | 注入的侧边栏 slot；不可用时自动降级为悬浮抽屉 |
| `providerIdPrefix` | `freehub` | 生成的 Provider ID 前缀 |
| `footerLinks` | 三条固定菜单 | 底部菜单 `{label,url}` 数组 |

## 安全特性

- 用户 API Key 全程不经过本插件任何一端（只走 DSH 官方 write-only 凭据通道）；
- 面板渲染全部走安全 DOM API（无 innerHTML）；外链 `noopener noreferrer`；URL 仅接受 http/https；
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

## 开发

```bash
npm run build    # regenerate lib/ from src/
npm run verify   # CI check: lib/ in sync with src/
npm test         # node --test unit tests
php -l server-php/**/*.php   # PHP syntax gate (PHP >= 7.4)
```

## License

[MIT](LICENSE)

---

<a id="english"></a>

## Free Models Leaderboard — a community plugin for DeepSeek Harness

A paginated "Free Models" panel for the DSH web UI sidebar: expand a row to see the
API base URL, model name and a **"apply for your free key"** button linking to the
publisher's signup page, then one-click-write the custom provider into
*Settings → Models* — you only paste your free API key afterwards.

The list is served by the **author-operated backend** (`https://free-api.gd7.cn`, PHP 7.4 + SQLite);
the backend is a private component and is not distributed with this repository.
The plugin never sees your API keys — it works out of the box right after install.

```bash
dsh plugin add github:yu-wenchao/dsh-free-models-hub
```

Prebuilt artifacts are committed, so installation never asks for pnpm build-script
permissions. See the Chinese sections above for full docs; the security review and
acceptance matrices live under [`docs/`](docs/).
