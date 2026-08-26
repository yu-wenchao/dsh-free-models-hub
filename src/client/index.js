/**
 * dsh-free-models-hub · Client half (browser side).
 *
 * NOTE FOR HUMANS AND AGENTS ALIKE:
 * This file is NOT executed standalone. scripts/build.mjs strips `export `
 * keywords, prepends src/core.js (whose pure helpers — safeHttpUrl,
 * slugify, providerId, buildProviderEntry, toYamlSnippet, clampInt,
 * parseModelsResponse, pageWindow… — are therefore in scope here), wraps the
 * result in a lazy-CJS factory and writes lib/client.cjs. Do not add imports;
 * do not redeclare identifiers from core.js.
 *
 * Degradation policy (see docs/02 §4.3–§4.5):
 *  - preferred mount point is the configured sidebar slot; when unavailable,
 *    a floating drawer guarantees the feature survives DSH version drift.
 *  - one-click provider write goes through ctx.settingsScope("llm-pi-ai");
 *    every step is guarded and falls back to a copy-paste YAML dialog.
 *  - user API keys NEVER pass through this plugin.
 */

/* global safeHttpUrl slugify providerId buildProviderEntry toYamlSnippet clampInt parseModelsResponse */

export const name = 'free-models-hub-client'

// settingsScope is the documented client service for reading/writing the
// Host settings namespaces (see the settings-card cookbook). Declaring it
// here is what makes one-click provider writes possible; the web GUI stack
// always provides it.
export const inject = ['slots', 'settingsScope']

const STR = Object.freeze({
  panelTitle: '免费模型榜',
  close: '关闭',
  setupTitle: '配置数据源',
  setupHint: '填入站长提供的站点地址（域名根即可，例如 https://xxx.com）',
  setupPlaceholder: 'https://your-domain.com',
  setupSave: '保存数据源',
  loading: '加载中…',
  retry: '重试',
  empty: '站长还没有发布免费模型',
  errNet: '无法连接数据源，请稍后重试。',
  errCors: '若持续失败，请站长在后台「系统设置 → CORS 白名单」中加入本页地址。',
  apiLabel: 'API 调用地址',
  modelLabel: '模型名称',
  keyBtn: '点击这里申请免费密钥key',
  applyBtn: '一键配置到 DSH',
  applied: (pid) => `已写入提供方 ${pid} —— 到 设置 → 模型 找到它，粘贴你的免费 Key 保存后即可使用`,
  applying: '正在写入配置…',
  copied: '已复制',
  copyFail: '复制失败，请手动选择文本',
  pageInfo: (total, cur, tot) => `共 ${total} 个 · 第 ${cur}/${tot} 页`,
  first: '首页',
  prev: '上一页',
  next: '下一页',
  last: '末页',
  fallbackTitle: '一键配置需要手动收尾',
  fallbackBody: '当前版本未能自动写入设置。请将下面的 YAML 加入 $DSH_HOME/settings.yaml（或在 设置 → 模型 手动添加自定义提供方），然后为其填写你的免费 API Key：',
  fallbackCopy: '复制 YAML',
  fallbackClose: '我知道了',
  badSource: '数据源地址无效（需 http/https 绝对地址）',
  batchBtn: '⚡ 配置本页全部',
  batchApplying: (n) => `正在配置 ${n} 个模型…`,
  batchDone: (ok, fail) => `批量配置完成：成功 ${ok} 个${fail ? `，失败 ${fail} 个` : ''}`,
  poolBtn: '🔄 多 Key 轮换',
  poolTitle: '多 Key 轮换配置',
  poolHint: '每行一个 API Key，启用后将通过本地代理自动轮询分发。',
  poolSave: '保存并启用',
  poolDisable: '关闭轮换',
  poolSaved: (n) => `已启用 ${n} 个 Key 轮换`,
  poolCleared: '已关闭轮换，恢复直连',
  proxyOffline: '本地轮换代理未运行，请确认插件已正常加载。',
  badgeHot: '热门',
  badgeRec: '推荐',
  refreshBtn: '🔄 刷新',
  refreshing: '刷新中…',
  refreshDone: (n) => `已刷新，${n} 个模型`,
  upgradeBtn: '⬆ 升级',
  upgradeChecking: '检查更新…',
  upgradeLatest: '已是最新版本',
  upgradeDownloading: '正在下载…',
  upgradeDone: '升级完成，请重启',
  upgradeFailed: '升级失败',
  upgradeNoPermission: '升级需要本地代理支持',
})

const DEFAULTS = Object.freeze({
  // Author-operated data source: the panel is usable right after install.
  backendUrl: 'https://free-api.gd7.cn',
  pageSize: 20,
  requestTimeoutMs: 10000,
  // Empty (default) = deterministic right-edge drawer with its own toggle
  // button. Set a slot name only if you explicitly want in-sidebar mounting.
  uiSlot: '',
  providerIdPrefix: 'freehub',
  proxyPort: 8787,
  footerLinks: [
    { label: '技术笔记', url: 'http://blog.4wc.cn' },
    { label: '插件开发', url: 'https://blog.gd7.cn/' },
    { label: '联系站长', url: 'http://web.wuyiyun.cn/' },
  ],
})

const LS_BACKEND = 'fmh:backendUrl'
const LS_OPEN = 'fmh:drawerOpen'

/* ------------------------------------------------------------------ utils */

function dbg(...args) {
  try { console.log('[free-models-hub]', ...args) } catch { /* ignore */ }
}

/** Minimal XSS-safe element builder: strings become text nodes, never HTML. */
function el(tag, props = {}, children = []) {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue
    if (k === 'class') node.className = v
    else if (k === 'text') node.textContent = String(v)
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v)
    else if (k === 'dataset') Object.assign(node.dataset, v)
    else node.setAttribute(k, v === true ? '' : String(v))
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child)
  }
  return node
}

function joinApiUrl(base) {
  const clean = base.trim().replace(/\/+$/, '')
  try {
    const u = new URL(clean)
    const p = u.pathname.replace(/\/+$/, '')
    // Explicit endpoint or legacy full path -> use as-is.
    if (/\/api\/models(\.php)?$/i.test(p) || /\.php$/i.test(p)) return u.toString()
    // Domain root (the common case): the backend routes everything cleanly.
    u.pathname = `${p}/api/models`
    return u.toString()
  } catch {
    return ''
  }
}

/** Endpoint candidates: clean route first, physical .php fallback for hosts
 *  without URL rewriting. Validation of the payload (not just the status
 *  code) decides which one actually serves data. */
function apiCandidates(base) {
  const primary = joinApiUrl(base)
  const out = [primary]
  try {
    const alt = new URL(primary)
    alt.pathname = alt.pathname.replace(/\/api\/models$/i, '/api/models.php')
    const s = alt.toString()
    if (s !== primary) out.push(s)
  } catch { /* primary already invalid; single candidate keeps error path */ }
  return out
}

async function copyText(text) {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch { /* fall through */ }
  try {
    const ta = el('textarea', { style: 'position:fixed;opacity:0' })
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  } catch {
    return false
  }
}

/* ------------------------------------------------------- config resolution */

function readLocalOverride() {
  try { return localStorage.getItem(LS_BACKEND) || '' } catch { return '' }
}

function saveLocalOverride(url) {
  try { localStorage.setItem(LS_BACKEND, url) } catch { /* private mode etc. */ }
}

/** Resolve effective client config: defaults <- host composition <- local override. */
function resolveClientConfig(ctx) {
  const cfg = {
    backendUrl: DEFAULTS.backendUrl,
    pageSize: DEFAULTS.pageSize,
    requestTimeoutMs: DEFAULTS.requestTimeoutMs,
    uiSlot: DEFAULTS.uiSlot,
    providerIdPrefix: DEFAULTS.providerIdPrefix,
    proxyPort: DEFAULTS.proxyPort,
    footerLinks: [...DEFAULTS.footerLinks],
  }
  try {
    const scope = ctx && ctx.settingsScope
    if (scope && typeof scope.bind === 'function') {
      const bound = scope.bind({ namespace: 'free-models-hub' })
      const resolved = bound && (bound.value || bound.base || bound)
      if (resolved && typeof resolved === 'object') {
        if (typeof resolved.backendUrl === 'string') cfg.backendUrl = resolved.backendUrl.trim()
        const ps = Number(resolved.pageSize); if (Number.isFinite(ps)) cfg.pageSize = clampInt(ps, 1, 50, cfg.pageSize)
        const tmo = Number(resolved.requestTimeoutMs); if (Number.isFinite(tmo)) cfg.requestTimeoutMs = clampInt(tmo, 1000, 60000, cfg.requestTimeoutMs)
        if (typeof resolved.uiSlot === 'string' && resolved.uiSlot.trim()) cfg.uiSlot = resolved.uiSlot.trim()
        if (typeof resolved.providerIdPrefix === 'string' && /^[a-z][a-z0-9-]{0,20}$/.test(resolved.providerIdPrefix)) cfg.providerIdPrefix = resolved.providerIdPrefix
        const pp = Number(resolved.proxyPort); if (Number.isFinite(pp)) cfg.proxyPort = clampInt(pp, 1024, 65535, cfg.proxyPort)
        if (Array.isArray(resolved.footerLinks)) {
          const links = []
          for (const item of resolved.footerLinks.slice(0, 6)) {
            const label = item && typeof item.label === 'string' ? item.label.trim().slice(0, 24) : ''
            const url = safeHttpUrl(item && item.url)
            if (label && url) links.push({ label, url })
          }
          if (links.length) cfg.footerLinks = links
        }
      }
    }
  } catch (error) {
    dbg('settingsScope probe failed, using defaults:', error && error.message)
  }
  const local = safeHttpUrl(readLocalOverride())
  if (local) cfg.backendUrl = local.replace(/\/+$/, '')
  return cfg
}

/* ------------------------------------------------------------------- style */

const CSS = `
.fmh-panel{--fmh-line:#8884;color:inherit;font:12px/1.5 var(--dsw-font,system-ui,sans-serif)}
.fmh-panel,.fmh-drawer-panel,.fmh-dialog *,.fmh-toast{box-sizing:border-box}
.fmh-panel{display:flex;flex-direction:column;border-top:1px solid var(--fmh-line);margin-top:6px;padding-top:8px;color:var(--dsw-text,#ddd)}
.fmh-head{display:flex;align-items:center;justify-content:space-between;padding:2px 8px 6px}
.fmh-title{font-weight:600;font-size:12px;letter-spacing:.02em;display:flex;align-items:center;gap:6px}
.fmh-fold{background:none;border:none;color:inherit;cursor:pointer;font-size:11px;padding:2px 6px;border-radius:6px;opacity:.75}
.fmh-fold:hover{opacity:1;background:rgba(128,128,128,.15)}
.fmh-body{display:flex;flex-direction:column;gap:6px;padding:0 6px}
.fmh-setup{display:flex;flex-direction:column;gap:6px;background:rgba(127,127,127,.08);border-radius:8px;padding:8px}
.fmh-setup p{margin:0;opacity:.7;font-size:11px}
.fmh-setup input{width:100%;border-radius:6px;border:1px solid var(--fmh-line);background:transparent;color:inherit;padding:5px 8px;font-size:12px}
.fmh-setup button,.fmh-retry{align-self:flex-start;border:none;border-radius:6px;padding:5px 12px;font-size:12px;cursor:pointer;background:#4176E6;color:#fff}
.fmh-state{padding:10px 4px;text-align:center;opacity:.65;font-size:12px}
.fmh-skel{height:14px;border-radius:6px;background:linear-gradient(90deg,rgba(127,127,127,.12),rgba(127,127,127,.22),rgba(127,127,127,.12));background-size:200% 100%;animation:fmh-sh 1.1s linear infinite;margin:6px 2px}
@keyframes fmh-sh{to{background-position:-200% 0}}
.fmh-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px}
.fmh-row{border-radius:8px}
.fmh-row:hover{background:rgba(127,127,127,.09)}
.fmh-row-title{display:flex;width:100%;gap:6px;align-items:baseline;text-align:left;background:none;border:none;color:inherit;font:inherit;cursor:pointer;padding:5px 6px;border-radius:8px}
.fmh-rank{flex:0 0 auto;min-width:18px;text-align:right;opacity:.55;font-variant-numeric:tabular-nums}
.fmh-name{flex:1 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fmh-caret{flex:0 0 auto;opacity:.45;transition:transform .15s}
.fmh-row-title[aria-expanded="true"] .fmh-caret{transform:rotate(90deg)}
.fmh-detail{display:none;flex-direction:column;gap:6px;margin:2px 6px 8px 30px;padding:8px;border-radius:8px;background:rgba(127,127,127,.1)}
.fmh-detail.open{display:flex}
.fmh-field{display:flex;flex-direction:column;gap:2px}
.fmh-field b{font-weight:600;opacity:.6;font-size:11px}
.fmh-code{display:flex;align-items:center;gap:6px;min-width:0}
.fmh-code code{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:rgba(0,0,0,.25);padding:3px 6px;border-radius:5px}
.fmh-copy{background:none;border:none;color:inherit;opacity:.6;cursor:pointer;font-size:11px;padding:2px 4px}
.fmh-copy:hover{opacity:1}
.fmh-actions{display:flex;flex-direction:column;gap:6px;margin-top:2px}
.fmh-btn{display:block;text-align:center;border-radius:8px;padding:7px 10px;font-size:12px;cursor:pointer;text-decoration:none;border:1px solid transparent}
a.fmh-btn-key{color:#ffd166;border-color:#ffd16666}
a.fmh-btn-key:hover{background:rgba(255,209,102,.12)}
button.fmh-btn-apply{background:#4176E6;color:#fff;border:none}
button.fmh-btn-apply[disabled]{opacity:.55;cursor:wait}
.fmh-pager{display:flex;flex-wrap:wrap;align-items:center;gap:3px;padding:4px 2px 2px}
.fmh-pager button{min-width:24px;height:22px;padding:0 6px;border-radius:6px;border:1px solid var(--fmh-line);background:none;color:inherit;font-size:11px;cursor:pointer}
.fmh-pager button[aria-current="true"]{background:#4176E6;border-color:#4176E6;color:#fff}
.fmh-pager button:disabled{opacity:.35;cursor:not-allowed}
.fmh-pager .fmh-dots{padding:0 2px;opacity:.5}
.fmh-pageinfo{flex-basis:100%;text-align:center;opacity:.55;font-size:11px;padding-top:2px}
.fmh-foot{display:flex;justify-content:center;gap:4px;flex-wrap:wrap;padding:6px 0 2px;border-top:1px solid var(--fmh-line);margin-top:4px}
.fmh-foot a{color:inherit;opacity:.65;text-decoration:none;font-size:11px}
.fmh-foot a:hover{opacity:1;text-decoration:underline}
.fmh-launcher{position:fixed;right:14px;top:50%;transform:translateY(-50%);width:46px;height:46px;border-radius:50%;border:none;background:linear-gradient(135deg,#4176E6,#7b5cff);color:#fff;font-size:20px;cursor:pointer;z-index:99997;box-shadow:0 4px 16px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;transition:transform .15s}
.fmh-launcher:hover{transform:translateY(-50%) scale(1.08)}
.fmh-drawer{position:fixed;top:0;right:0;bottom:0;width:min(360px,94vw);z-index:99999;background:#1b1d23;border-left:1px solid #ffffff22;box-shadow:-12px 0 40px rgba(0,0,0,.45);transform:translateX(105%);transition:transform .22s ease;display:flex;flex-direction:column;overflow:hidden}
.fmh-drawer.open{transform:translateX(0)}
.fmh-drawer-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid #ffffff14;color:#e8eaf0;font-weight:600;font-size:13px;flex:0 0 auto}
.fmh-drawer-close{background:none;border:none;color:inherit;font-size:15px;cursor:pointer;opacity:.7;padding:4px 9px;border-radius:6px}
.fmh-drawer-close:hover{opacity:1;background:rgba(255,255,255,.08)}
.fmh-drawer-body{flex:1;overflow:auto;padding:10px 12px}
.fmh-overlay{position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:20px}
.fmh-dialog{max-width:520px;width:100%;max-height:80vh;overflow:auto;background:#20232a;border:1px solid #ffffff22;border-radius:12px;padding:16px;color:#e8eaf0;font:13px/1.6 system-ui,sans-serif}
.fmh-dialog h3{margin:0 0 8px;font-size:14px}
.fmh-dialog p{opacity:.8;margin:0 0 10px}
.fmh-dialog pre{background:#12141a;border-radius:8px;padding:10px;overflow:auto;font:11px/1.5 ui-monospace,Menlo,Consolas,monospace}
.fmh-dialog .fmh-actions{flex-direction:row;justify-content:flex-end;margin-top:10px}
.fmh-dialog .fmh-actions .fmh-btn{padding:6px 14px}
.fmh-toast-wrap{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:100001;display:flex;flex-direction:column;gap:8px;align-items:center}
.fmh-toast{background:#262a33;color:#eef1f7;border-radius:8px;padding:9px 16px;font-size:12.5px;box-shadow:0 6px 24px rgba(0,0,0,.4);max-width:76vw}
.fmh-toast.ok{border-left:3px solid #34c77b}
.fmh-toast.err{border-left:3px solid #ff6b6b}
.fmh-badge{display:inline-block;font-size:10px;line-height:1;padding:2px 6px;border-radius:999px;margin-left:5px;vertical-align:1px;font-weight:600}
.fmh-badge.hot{background:rgba(212,56,13,.18);color:#ff7875;border:1px solid #a83a35}
.fmh-badge.rec{background:rgba(22,119,255,.16);color:#69b1ff;border:1px solid #1d4ed8}
.fmh-pin{opacity:.55;margin-right:2px}
.fmh-batch-bar{display:flex;align-items:center;gap:6px;padding:4px 6px}
.fmh-btn-batch{border:none;border-radius:6px;padding:5px 10px;font-size:11.5px;cursor:pointer;background:#4176E6;color:#fff;flex:0 0 auto}
.fmh-btn-batch[disabled]{opacity:.5;cursor:wait}
.fmh-pool-btn{border:none;border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer;background:rgba(127,127,127,.15);color:inherit;flex:0 0 auto;opacity:.75}
.fmh-pool-btn:hover{opacity:1;background:rgba(127,127,127,.25)}
.fmh-pool-textarea{width:100%;min-height:80px;border-radius:6px;border:1px solid var(--fmh-line,#555);background:rgba(0,0,0,.25);color:inherit;padding:8px;font:12px/1.5 ui-monospace,Menlo,Consolas,monospace;resize:vertical}
.fmh-dialog .fmh-actions{flex-direction:row;justify-content:flex-end;gap:8px;margin-top:10px}
.fmh-upgrade-btn{background:none;border:none;color:inherit;opacity:.65;cursor:pointer;font-size:11px;padding:0 4px}
.fmh-upgrade-btn:hover{opacity:1;text-decoration:underline}
`

function ensureStyle() {
  if (!document.getElementById('fmh-style')) {
    const tag = el('style', { id: 'fmh-style', text: CSS })
    document.head.appendChild(tag)
  }
}

/* ------------------------------------------------------------------ widget */

export function apply(ctx) {
  const cfg = resolveClientConfig(ctx)
  ensureStyle()

  const state = {
    backendUrl: cfg.backendUrl,
    pageSize: cfg.pageSize,
    page: 1,
    data: null,
    loading: false,
    error: '',
    expanded: new Set(),
  }

  /* ---- toast ---- */
  const toastWrap = el('div', { class: 'fmh-toast-wrap' })
  function toast(message, kind = 'ok') {
    const t = el('div', { class: `fmh-toast ${kind}`, text: message })
    toastWrap.appendChild(t)
    setTimeout(() => t.remove(), 3500)
  }

  /* ---- DOM scaffold ---- */
  const listEl = el('ul', { class: 'fmh-list' })
  const stateEl = el('div', { class: 'fmh-state' })
  const pagerEl = el('nav', { class: 'fmh-pager', 'aria-label': 'pagination' })

  const setupInput = el('input', {
    type: 'url',
    placeholder: STR.setupPlaceholder,
    spellcheck: 'false',
    onkeydown: (ev) => { if (ev.key === 'Enter') saveSetup() },
  })
  const setupBox = el('div', { class: 'fmh-setup' }, [
    el('p', { text: STR.setupHint }),
    setupInput,
    el('button', { type: 'button', onclick: saveSetup, text: STR.setupSave }),
  ])

  const upgradeBtn = el('button', {
    class: 'fmh-upgrade-btn', type: 'button', text: STR.upgradeBtn,
    onclick: () => checkUpgrade(),
  })
  const footEl = el('footer', { class: 'fmh-foot' }, [
    ...cfg.footerLinks.map((l, i) => {
      const link = el('a', { href: l.url, target: '_blank', rel: 'noopener noreferrer', text: l.label })
      return i === 0 ? link : [el('span', { class: 'fmh-dots', text: '·' }), link]
    }),
    el('span', { class: 'fmh-dots', text: '·' }),
    upgradeBtn,
  ])

  const batchBtn = el('button', {
    class: 'fmh-btn-batch', type: 'button', text: STR.batchBtn,
    onclick: () => batchApplyAll(),
  })
  const refreshBtn = el('button', {
    class: 'fmh-btn-batch', type: 'button', text: STR.refreshBtn,
    style: 'background:#34c77b',
    onclick: () => { state.expanded.clear(); loadPage(state.page) },
  })
  const batchBar = el('div', { class: 'fmh-batch-bar' }, [batchBtn, refreshBtn])

  const bodyEl = el('div', { class: 'fmh-body' }, [setupBox, stateEl, batchBar, listEl, pagerEl, footEl])
  const root = el('section', { class: 'fmh-panel' }, [bodyEl])
  document.body.appendChild(toastWrap)

  function saveSetup() {
    const url = safeHttpUrl(setupInput.value)
    if (!url) { toast(STR.badSource, 'err'); return }
    state.backendUrl = url.replace(/\/+$/, '')
    saveLocalOverride(state.backendUrl)
    setupBox.style.display = 'none'
    loadPage(1)
  }

  /* ---- rendering ---- */
  function renderState() {
    setupBox.style.display = state.backendUrl ? 'none' : ''
    batchBar.style.display = (state.backendUrl && state.data && state.data.items.length > 0) ? '' : 'none'
    stateEl.textContent = ''
    if (!state.backendUrl) { stateEl.textContent = ''; return }
    if (state.loading) {
      stateEl.className = 'fmh-state'
      stateEl.appendChild(el('div', { class: 'fmh-skel' }))
      stateEl.appendChild(el('div', { class: 'fmh-skel' }))
      stateEl.appendChild(el('div', { class: 'fmh-skel' }))
      return
    }
    if (state.error) {
      stateEl.className = 'fmh-state'
      stateEl.appendChild(el('div', { text: `${STR.errNet}${state.error}` }))
      stateEl.appendChild(el('div', { text: STR.errCors }))
      stateEl.appendChild(el('button', { class: 'fmh-retry', type: 'button', onclick: () => loadPage(state.page), text: STR.retry }))
      return
    }
    if (state.data && state.data.total === 0) stateEl.textContent = STR.empty
  }

  function renderDetail(item) {
    const codeBase = el('code', { text: item.apiBase })
    const modelsText = Array.isArray(item.modelIds) ? item.modelIds.join(', ') : item.modelId || ''
    const codeModel = el('code', { text: modelsText, title: modelsText })
    const keyBtn = item.keyUrl
      ? el('a', { class: 'fmh-btn fmh-btn-key', href: item.keyUrl, target: '_blank', rel: 'noopener noreferrer', text: `🔑 ${STR.keyBtn}` })
      : el('a', { class: 'fmh-btn fmh-btn-key', 'aria-disabled': 'true', style: 'opacity:.4;pointer-events:none', text: `🔑 ${STR.keyBtn}` })
    const applyBtn = el('button', {
      class: 'fmh-btn fmh-btn-apply', type: 'button', text: `⚡ ${STR.applyBtn}`,
      onclick: async (ev) => {
        const btn = ev.currentTarget
        btn.disabled = true
        btn.textContent = STR.applying
        try { await applyProvider(item) } finally { btn.disabled = false; btn.textContent = `⚡ ${STR.applyBtn}` }
      },
    })
    return el('div', { class: 'fmh-detail', dataset: { fmhId: String(item.id) } }, [
      el('div', { class: 'fmh-field' }, [
        el('b', { text: STR.apiLabel }),
        el('span', { class: 'fmh-code' }, [codeBase, el('button', { class: 'fmh-copy', type: 'button', title: 'copy', onclick: async () => toast(await copyText(item.apiBase) ? STR.copied : STR.copyFail), text: '⧉' })]),
      ]),
      el('div', { class: 'fmh-field' }, [
        el('b', { text: STR.modelLabel }),
        el('span', { class: 'fmh-code' }, [codeModel, el('button', { class: 'fmh-copy', type: 'button', title: 'copy', onclick: async () => toast(await copyText(modelsText) ? STR.copied : STR.copyFail), text: '⧉' })]),
      ]),
      el('div', { class: 'fmh-actions' }, [
        keyBtn,
        applyBtn,
        el('button', {
          class: 'fmh-pool-btn', type: 'button', text: STR.poolBtn,
          onclick: (ev) => { ev.stopPropagation(); openPoolDialog(item) },
        }),
      ]),
    ])
  }

  function renderList() {
    listEl.textContent = ''
    if (!state.data || state.loading || state.error) return
    const offset = (state.data.page - 1) * state.data.pageSize
    state.data.items.forEach((item, idx) => {
      const key = String(item.id)
      const detail = renderDetail(item)
      if (state.expanded.has(key)) detail.classList.add('open')
      const title = el('button', {
        class: 'fmh-row-title', type: 'button',
        'aria-expanded': state.expanded.has(key) ? 'true' : 'false',
        onclick: () => {
          if (state.expanded.has(key)) state.expanded.delete(key)
          else state.expanded.add(key)
          detail.classList.toggle('open')
          title.setAttribute('aria-expanded', detail.classList.contains('open') ? 'true' : 'false')
        },
      }, [
        el('span', { class: 'fmh-rank', text: `${offset + idx + 1}.` }),
        el('span', { class: 'fmh-name', title: item.title }, [
          item.pinned ? el('span', { class: 'fmh-pin', text: '📌' }) : null,
          item.title,
          item.badge === 'hot' ? el('span', { class: 'fmh-badge hot', text: STR.badgeHot }) : null,
          item.badge === 'rec' ? el('span', { class: 'fmh-badge rec', text: STR.badgeRec }) : null,
        ]),
        el('span', { class: 'fmh-caret', text: '›' }),
      ])
      listEl.appendChild(el('li', { class: 'fmh-row' }, [title, detail]))
    })
  }

  function renderPager() {
    pagerEl.textContent = ''
    if (!state.data || state.loading || state.error || state.data.totalPages <= 0) return
    const { page, totalPages } = state.data
    if (totalPages <= 1) return
    const mk = (label, target, opts = {}) => {
      const disabled = opts.disabled === true
      return el('button', {
        type: 'button', text: label, disabled,
        'aria-label': opts.aria || label,
        ...(opts.current ? { 'aria-current': 'true' } : {}),
        onclick: disabled || opts.current ? undefined : () => loadPage(target),
      })
    }
    pagerEl.appendChild(mk('«', 1, { aria: STR.first, disabled: page <= 1 }))
    pagerEl.appendChild(mk('‹', page - 1, { aria: STR.prev, disabled: page <= 1 }))
    for (const part of pageWindow(page, totalPages)) {
      if (part === '…') pagerEl.appendChild(el('span', { class: 'fmh-dots', text: '…' }))
      else pagerEl.appendChild(mk(String(part), part, { current: part === page }))
    }
    pagerEl.appendChild(mk('›', page + 1, { aria: STR.next, disabled: page >= totalPages }))
    pagerEl.appendChild(mk('»', totalPages, { aria: STR.last, disabled: page >= totalPages }))
    pagerEl.appendChild(el('span', { class: 'fmh-pageinfo', text: STR.pageInfo(state.data.total, page, totalPages) }))
  }

  function renderAll() { renderState(); renderList(); renderPager() }

  /* ---- data ---- */
  let seq = 0
  let timer = null
  let apiEndpoint = '' // remembered once a candidate validates

  async function fetchModels(endpoint, signal) {
    const res = await fetch(endpoint, { signal, credentials: 'omit', headers: { Accept: 'application/json' } })
    if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { fmhTryNext: res.status >= 400 && res.status < 500 })
    const payload = await res.json()
    const data = parseModelsResponse(payload, state.pageSize) // throws on non-JSON / bad shape
    return { data, endpoint }
  }

  async function loadPage(page) {
    if (!state.backendUrl) { renderAll(); return }
    const mySeq = ++seq
    state.loading = true
    state.error = ''
    state.page = page
    state.expanded.clear()
    renderAll()
    const ctrl = new AbortController()
    timer = setTimeout(() => ctrl.abort(), cfg.requestTimeoutMs)
    try {
      const candidates = apiEndpoint ? [apiEndpoint] : apiCandidates(state.backendUrl)
      let lastError = null
      let result = null
      for (const endpoint of candidates) {
        try {
          result = await fetchModels(endpoint, ctrl.signal)
          apiEndpoint = endpoint // remember the one that validated
          break
        } catch (error) {
          lastError = error
          if (error && error.name === 'AbortError') throw error
          // Try the next candidate unless the server said "no endpoint here".
          if (!(error && error.fmhTryNext) && candidates.length === 1) throw error
        }
      }
      if (!result) throw lastError || new Error('no endpoint')
      if (mySeq !== seq) return // stale response, drop
      state.data = result.data
      state.loading = false
    } catch (error) {
      if (mySeq !== seq) return
      state.loading = false
      state.error = error && error.name === 'AbortError' ? '(timeout)' : `(${error && error.message})`
      dbg('fetch failed:', error && error.message)
    } finally {
      clearTimeout(timer)
      if (mySeq === seq) renderAll()
    }
  }

  /* ---- provider write ---- */
  function getBoundNamespace(namespace) {
    try {
      const scope = ctx && ctx.settingsScope
      if (scope && typeof scope.bind === 'function') return scope.bind({ namespace })
    } catch (error) {
      dbg('settingsScope bind failed:', error && error.message)
    }
    return null
  }

  function readProviders(bound) {
    try {
      const v = bound && (bound.value || bound.base || bound)
      const providers = v && v.providers
      return providers && typeof providers === 'object' ? { ...providers } : {}
    } catch {
      return {}
    }
  }

  function showFallbackDialog(pid, entry) {
    const yaml = toYamlSnippet({ pid, entry })
    const close = () => overlay.remove()
    const pre = el('pre', {}, [el('code', { text: yaml })])
    const overlay = el('div', {
      class: 'fmh-overlay',
      onclick: (ev) => { if (ev.target === overlay) close() },
    }, [el('div', { class: 'fmh-dialog', role: 'dialog', 'aria-modal': 'true' }, [
      el('h3', { text: STR.fallbackTitle }),
      el('p', { text: STR.fallbackBody }),
      pre,
      el('div', { class: 'fmh-actions' }, [
        el('button', { class: 'fmh-btn', type: 'button', onclick: async () => toast(await copyText(yaml) ? STR.copied : STR.copyFail), text: STR.fallbackCopy }),
        el('button', { class: 'fmh-btn fmh-btn-apply', type: 'button', onclick: close, text: STR.fallbackClose }),
      ]),
    ])])
    document.body.appendChild(overlay)
    const esc = (ev) => { if (ev.key === 'Escape') { close(); document.removeEventListener('keydown', esc) } }
    document.addEventListener('keydown', esc)
  }

  async function applyProvider(item) {
    const { pid, entry } = buildProviderEntry({
      prefix: cfg.providerIdPrefix,
      title: item.title,
      apiBase: item.apiBase,
      modelIds: item.modelIds,
      rowId: item.id,
    })
    const bound = getBoundNamespace('llm-pi-ai')
    if (!bound || typeof bound.set !== 'function') { showFallbackDialog(pid, entry); return }
    try {
      const providers = readProviders(bound)
      providers[pid] = entry
      await bound.set('providers', providers)
      // Verify on the SAME bound scope; a mismatch sends the user the manual path.
      const after = readProviders(bound)
      if (after[pid] && after[pid].baseURL === entry.baseURL) {
        toast(STR.applied(pid), 'ok')
      } else {
        showFallbackDialog(pid, entry)
      }
    } catch (error) {
      dbg('provider write failed:', error && error.message)
      showFallbackDialog(pid, entry)
    }
  }

  /* ---- proxy probe ---- */
  async function probeProxy() {
    for (let port = cfg.proxyPort; port < cfg.proxyPort + 10; port++) {
      try {
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), 800)
        const res = await fetch(`http://127.0.0.1:${port}/p/ping`, {
          signal: ctrl.signal, mode: 'cors', credentials: 'omit',
        })
        clearTimeout(timer)
        if (res.ok) return port
      } catch { /* try next */ }
    }
    return null
  }

  /* ---- readField helpers ---- */
  function readField(bound, key, fallback) {
    try {
      const v = bound && (bound.value || bound.base || bound)
      const val = v && v[key]
      return val && typeof val === 'object' ? { ...val } : { ...fallback }
    } catch { return { ...fallback } }
  }

  /* ---- multi-key pool ---- */
  async function writeProviderEnsure(item) {
    const { pid, entry } = buildProviderEntry({
      prefix: cfg.providerIdPrefix,
      title: item.title,
      apiBase: item.apiBase,
      modelIds: item.modelIds,
      rowId: item.id,
    })
    const bound = getBoundNamespace('llm-pi-ai')
    if (!bound || typeof bound.set !== 'function') return { pid, ok: false }
    try {
      const providers = readProviders(bound)
      providers[pid] = entry
      await bound.set('providers', providers)
      return { pid, ok: true }
    } catch {
      return { pid, ok: false }
    }
  }

  async function saveKeyPool(item, keys) {
    const { pid, ok } = await writeProviderEnsure(item)
    if (!ok) { toast(STR.proxyOffline, 'err'); return }

    // Save to settings scope (live, in-memory)
    const hub = getBoundNamespace('free-models-hub')
    const lp = getBoundNamespace('llm-pi-ai')
    let poolsSaved = false

    if (hub && typeof hub.set === 'function') {
      try {
        const pools = readField(hub, 'keyPools', {})
        const targets = readField(hub, 'targets', {})
        pools[pid] = keys
        targets[pid] = item.apiBase
        await hub.set('keyPools', pools)
        await hub.set('targets', targets)
        poolsSaved = true
      } catch { /* fall through */ }
    }

    // Also persist to proxy file (survives restart)
    const port = await probeProxy()
    if (port) {
      try {
        const existingRes = await fetch(`http://127.0.0.1:${port}/p/load-pools`, { mode: 'cors', credentials: 'omit' }).catch(() => null)
        const existing = existingRes && existingRes.ok ? await existingRes.json().catch(() => ({})) : {}
        const mergedPools = { ...(existing.keyPools || {}), [pid]: keys }
        const mergedTargets = { ...(existing.targets || {}), [pid]: item.apiBase }
        await fetch(`http://127.0.0.1:${port}/p/save-pools`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyPools: mergedPools, targets: mergedTargets }),
        })
      } catch { /* best effort */ }
    }

    // Rewrite baseURL to point to local proxy
    if (port && lp && typeof lp.set === 'function') {
      const providers = readProviders(lp)
      if (providers[pid]) {
        providers[pid] = { ...providers[pid], baseURL: `http://127.0.0.1:${port}/p/${pid}` }
        await lp.set('providers', providers)
      }
      toast(STR.poolSaved(keys.length), 'ok')
    } else {
      toast(STR.poolSaved(keys.length) + '（代理未启动，轮换暂不可用，需重启 DSH）', 'ok')
    }
  }

  async function disableKeyPool(item) {
    const { pid } = buildProviderEntry({
      prefix: cfg.providerIdPrefix,
      title: item.title,
      apiBase: item.apiBase,
      modelIds: item.modelIds,
      rowId: item.id,
    })
    const hub = getBoundNamespace('free-models-hub')
    const lp = getBoundNamespace('llm-pi-ai')
    // Clear from settings scope
    if (hub && typeof hub.set === 'function') {
      try {
        const pools = readField(hub, 'keyPools', {})
        const targets = readField(hub, 'targets', {})
        const orig = targets[pid] || item.apiBase
        delete pools[pid]
        delete targets[pid]
        await hub.set('keyPools', pools)
        await hub.set('targets', targets)
        if (lp && typeof lp.set === 'function') {
          const providers = readProviders(lp)
          if (providers[pid]) {
            providers[pid] = { ...providers[pid], baseURL: orig, apiKeyEnv: apiKeyEnvName(pid) }
            await lp.set('providers', providers)
          }
        }
      } catch { /* best effort */ }
    }
    // Also clear from file-based pools via proxy
    const port = await probeProxy()
    if (port) {
      try {
        const existingRes = await fetch(`http://127.0.0.1:${port}/p/load-pools`, { mode: 'cors', credentials: 'omit' }).catch(() => null)
        const existing = existingRes && existingRes.ok ? await existingRes.json().catch(() => ({})) : {}
        const mergedPools = { ...(existing.keyPools || {}) }
        const mergedTargets = { ...(existing.targets || {}) }
        delete mergedPools[pid]
        delete mergedTargets[pid]
        await fetch(`http://127.0.0.1:${port}/p/save-pools`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyPools: mergedPools, targets: mergedTargets }),
        })
      } catch { /* best effort */ }
    }
    // Restore original baseURL in provider
    if (lp && typeof lp.set === 'function') {
      const providers = readProviders(lp)
      if (providers[pid]) {
        providers[pid] = { ...providers[pid], baseURL: item.apiBase }
        await lp.set('providers', providers)
      }
    }
    toast(STR.poolCleared, 'ok')
  }

  function openPoolDialog(item) {
    const ta = el('textarea', { class: 'fmh-pool-textarea', placeholder: 'sk-key1\nsk-key2\nsk-key3', spellcheck: 'false' })
    const close = () => overlay.remove()
    const save = async () => {
      const lines = ta.value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
      if (lines.length === 0) { toast('请输入至少一个 Key', 'err'); return }
      await saveKeyPool(item, lines)
      close()
    }
    const disable = async () => { await disableKeyPool(item); close() }
    const overlay = el('div', {
      class: 'fmh-overlay',
      onclick: (ev) => { if (ev.target === overlay) close() },
    }, [el('div', { class: 'fmh-dialog', role: 'dialog', 'aria-modal': 'true' }, [
      el('h3', { text: STR.poolTitle }),
      el('p', { text: STR.poolHint }),
      ta,
      el('div', { class: 'fmh-actions' }, [
        el('button', { class: 'fmh-btn', type: 'button', text: STR.poolDisable, onclick: disable }),
        el('button', { class: 'fmh-btn fmh-btn-apply', type: 'button', text: STR.poolSave, onclick: save }),
      ]),
    ])])
    document.body.appendChild(overlay)
    ta.focus()
    const esc = (ev) => { if (ev.key === 'Escape') { close(); document.removeEventListener('keydown', esc) } }
    document.addEventListener('keydown', esc)
  }

  /* ---- batch apply ---- */
  async function batchApplyAll() {
    if (!state.data || !state.data.items.length) return
    const items = state.data.items
    const bound = getBoundNamespace('llm-pi-ai')
    if (!bound || typeof bound.set !== 'function') { toast(STR.proxyOffline, 'err'); return }
    batchBtn.disabled = true
    batchBtn.textContent = STR.batchApplying(items.length)
    try {
      const providers = readProviders(bound)
      let count = 0
      for (const item of items) {
        const { pid, entry } = buildProviderEntry({
          prefix: cfg.providerIdPrefix,
          title: item.title,
          apiBase: item.apiBase,
          modelIds: item.modelIds,
          rowId: item.id,
        })
        providers[pid] = entry
        count++
      }
      await bound.set('providers', providers)
      toast(STR.batchDone(count, 0), 'ok')
    } catch (error) {
      dbg('batch apply failed:', error && error.message)
      toast(STR.batchDone(0, items.length), 'err')
    } finally {
      batchBtn.disabled = false
      batchBtn.textContent = STR.batchBtn
    }
  }

  /* ---- upgrade check ---- */
  const CURRENT_VERSION = '0.3.0'
  const GITHUB_REPO = 'yu-wenchao/dsh-free-models-hub'
  const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`
  const PROFILE_URL = 'https://github.com/' + GITHUB_REPO + '/releases/latest'

  async function checkUpgrade() {
    upgradeBtn.textContent = STR.upgradeChecking
    try {
      const res = await fetch(GITHUB_API, { headers: { Accept: 'application/vnd.github.v3+json' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const latest = (data.tag_name || '').replace(/^v/, '')
      if (!latest || latest === CURRENT_VERSION) {
        toast(STR.upgradeLatest, 'ok')
        upgradeBtn.textContent = STR.upgradeBtn
        return
      }
      // Show upgrade dialog with download link
      const close = () => overlay.remove()
      const overlay = el('div', {
        class: 'fmh-overlay',
        onclick: (ev) => { if (ev.target === overlay) close() },
      }, [el('div', { class: 'fmh-dialog', role: 'dialog', 'aria-modal': 'true' }, [
        el('h3', { text: `发现新版本 v${latest}` }),
        el('p', { text: `当前版本 v${CURRENT_VERSION} → v${latest}` }),
        el('p', { text: '请到以下地址下载最新 release，解压后替换 plugins 目录中的 dsh-free-models-hub 文件夹：' }),
        el('a', {
          href: PROFILE_URL,
          target: '_blank',
          rel: 'noopener noreferrer',
          text: PROFILE_URL,
          style: 'color:#69b1ff;word-break:break-all',
        }),
        el('div', { class: 'fmh-actions' }, [
          el('button', { class: 'fmh-btn fmh-btn-apply', type: 'button', onclick: close, text: STR.fallbackClose }),
        ]),
      ])])
      document.body.appendChild(overlay)
    } catch (error) {
      dbg('upgrade check failed:', error && error.message)
      toast(STR.upgradeFailed, 'err')
    }
    upgradeBtn.textContent = STR.upgradeBtn
  }

  /* ---- mounting ---- */
  // Slot mounting is opt-in (config uiSlot). The default is a deterministic
  // right-edge toggle button + slide-in drawer, which looks the same on every
  // DSH build regardless of internal slot layout changes.
  function trySlotInjection() {
    if (!cfg.uiSlot) return null
    const slots = ctx && ctx.slots
    if (!slots || typeof slots.inject !== 'function') return null
    try {
      const head = el('header', { class: 'fmh-head' }, [
        el('span', { class: 'fmh-title', text: `🎁 ${STR.panelTitle}` }),
      ])
      const slotted = el('section', { class: 'fmh-panel' }, [head, bodyEl])
      slots.inject(cfg.uiSlot, () => {
        if (typeof slots.register !== 'function') return slotted
        return slots.register({
          name: cfg.uiSlot,
          key: 'free-models-hub',
          inject: () => slotted,
        })
      })
      dbg(`panel injected into slot "${cfg.uiSlot}"`)
      return () => {
        try {
          if (typeof slots.remove === 'function') slots.remove('free-models-hub')
          else if (typeof slots.unregister === 'function') slots.unregister('free-models-hub')
        } catch { /* framework cleanup handles the rest */ }
      }
    } catch (error) {
      dbg(`slot injection failed (${error && error.message}); using right drawer`)
      return null
    }
  }

  function installRightDrawer() {
    const drawer = el('aside', { class: 'fmh-drawer', 'aria-label': STR.panelTitle })
    const head = el('div', { class: 'fmh-drawer-head' }, [
      el('span', { text: `🎁 ${STR.panelTitle}` }),
      el('button', {
        class: 'fmh-drawer-close', type: 'button', text: '✕', title: STR.close,
        onclick: () => setOpen(false),
      }),
    ])
    const bodyWrap = el('div', { class: 'fmh-drawer-body' }, [root])
    drawer.appendChild(head)
    drawer.appendChild(bodyWrap)

    const launcher = el('button', {
      class: 'fmh-launcher', type: 'button', text: '🎁', title: STR.panelTitle,
      'aria-label': STR.panelTitle,
      onclick: () => setOpen(!drawer.classList.contains('open')),
    })

    function setOpen(open) {
      drawer.classList.toggle('open', open)
      try { localStorage.setItem(LS_OPEN, open ? '1' : '0') } catch { /* ignore */ }
    }

    const esc = (ev) => { if (ev.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', esc)

    document.body.appendChild(launcher)
    document.body.appendChild(drawer)

    let initial = false
    try { initial = localStorage.getItem(LS_OPEN) === '1' } catch { /* ignore */ }
    if (initial) setOpen(true)

    return () => {
      document.removeEventListener('keydown', esc)
      launcher.remove()
      drawer.remove()
    }
  }

  const detachSlot = trySlotInjection()
  const detachDrawer = detachSlot ? null : installRightDrawer()

  // Load saved key pools from proxy file on startup
  ;(async () => {
    const port = await probeProxy()
    if (port) {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/p/load-pools`, { mode: 'cors', credentials: 'omit' })
        if (res.ok) {
          const data = await res.json()
          // Apply loaded pools to settings scope if available
          const hub = getBoundNamespace('free-models-hub')
          if (hub && typeof hub.set === 'function') {
            if (data.keyPools && Object.keys(data.keyPools).length) {
              await hub.set('keyPools', data.keyPools)
              await hub.set('targets', data.targets || {})
            }
          }
        }
      } catch { /* ignore */ }
    }
  })()

  ctx.effect(() => () => {
    seq++ // invalidate in-flight requests
    if (timer) clearTimeout(timer)
    if (detachDrawer) detachDrawer()
    if (detachSlot) detachSlot()
    toastWrap.remove()
  })

  if (state.backendUrl) loadPage(1)
  else renderAll()
}
