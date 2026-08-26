/**
 * dsh-free-models-hub · Host half (Node side of the bundle).
 *
 * Deliberately thin and defensive: every host-provided API is feature
 * detected so version drift in the developer preview cannot fail the fiber.
 * The browser half does the heavy lifting (panel UI, pagination,
 * provider writes); this half normalizes config, registers an optional
 * settings section so the client can read the resolved composition values,
 * and runs a local rotation proxy for multi-key pools.
 */
import {
  CONFIG_DEFAULTS,
  LOG_PREFIX,
  SECTION_NS,
  normalizeConfig,
  pickRotatedKey,
} from './core.js'

import http from 'node:http'
import https from 'node:https'

export const name = 'free-models-hub'

function log(debug, ...args) {
  if (debug) console.log(LOG_PREFIX, ...args)
}

function warn(...args) {
  console.warn(LOG_PREFIX, ...args)
}

export function apply(ctx, config = {}) {
  const { value: cfg, warnings } = normalizeConfig(config)
  for (const message of warnings) warn('config:', message)
  log(cfg.debug, 'loaded with config:', cfg)

  // Live settings source for the rotation proxy: updated by the settings
  // section (setSource) once it installs; falls back to boot config until then.
  let sectionSource = () => ({ keyPools: {}, targets: {} })

  // ---- rotation proxy (127.0.0.1 only) ----
  const counters = new Map()
  let proxyServer = null
  let actualPort = cfg.proxyPort

  function handleProxy(req, res) {
    // CORS for browser probes (panel ping / pool-check).
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

    const url = new URL(req.url, `http://127.0.0.1:${actualPort}`)
    const parts = url.pathname.replace(/^\/+/, '').split('/')
    const pid = parts[0]
    const rest = parts.slice(1).join('/')

    // health probe
    if (pid === 'p' && rest === 'ping') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('ok')
      return
    }

    if (pid !== 'p' || !rest) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'not found', hint: 'use /p/<pid>/<method-path>' }))
      return
    }

    const src = sectionSource()
    const targets = src && typeof src.targets === 'object' ? src.targets : {}
    const pools = src && typeof src.keyPools === 'object' ? src.keyPools : {}
    const targetBase = targets[pid]
    const pool = pools[pid]

    if (!targetBase) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'unknown provider', pid }))
      return
    }

    const target = targetBase.replace(/\/+$/, '') + '/' + rest + url.search
    const upHeaders = { ...req.headers }
    delete upHeaders.host
    delete upHeaders.connection
    delete upHeaders['content-length']
    delete upHeaders['transfer-encoding']

    // Round-robin key rotation when a pool is configured; otherwise pass
    // through whatever Authorization the inbound request already carries.
    const keyPool = Array.isArray(pool) ? pool.filter((k) => typeof k === 'string' && k.trim()) : []
    if (keyPool.length > 0) {
      if (!counters.has(pid)) counters.set(pid, { count: 0 })
      const key = pickRotatedKey(keyPool, counters.get(pid))
      if (key) upHeaders.authorization = `Bearer ${key}`
    }

    const opts = {
      hostname: '',
      port: 0,
      path: target,
      method: req.method,
      headers: upHeaders,
    }
    let parsed
    try { parsed = new URL(target) } catch { res.writeHead(502); res.end('bad target url'); return }
    opts.hostname = parsed.hostname
    opts.port = parsed.port || (parsed.protocol === 'https:' ? 443 : 80)
    opts.path = parsed.pathname + parsed.search

    const isHttps = parsed.protocol === 'https:'
    const upstream = isHttps ? https : http

    const proxyReq = upstream.request(opts, (proxyRes) => {
      const fwdHeaders = { ...proxyRes.headers }
      delete fwdHeaders['transfer-encoding']
      res.writeHead(proxyRes.statusCode, fwdHeaders)
      proxyRes.pipe(res)
    })
    proxyReq.on('error', () => { try { res.writeHead(502); res.end('upstream error') } catch { /* already sent */ } })
    req.pipe(proxyReq)
  }

  function startProxy(port) {
    const server = http.createServer(handleProxy)
    server.on('error', (err) => {
      if (err && err.code === 'EADDRINUSE' && port < cfg.proxyPort + 20) {
        log(cfg.debug, `port ${port} in use, trying ${port + 1}`)
        startProxy(port + 1)
      } else {
        warn(`rotation proxy failed to bind port ${port}:`, err && err.message)
      }
    })
    server.listen(port, '127.0.0.1', () => {
      actualPort = port
      proxyServer = server
      log(cfg.debug, `rotation proxy listening on 127.0.0.1:${port}`)
    })
  }
  startProxy(cfg.proxyPort)

  // Optional enhancement: expose our namespace on the settings page so the
  // client can read the resolved values (composition base included). Both
  // imports are feature-detected; when either is missing we simply skip —
  // the client then falls back to built-in defaults or a local override.
  let disposed = false
  let sectionDispose = null

  Promise.all([
    import('@deepseek-ai/schemastery').catch(() => null),
    import('@deepseek-ai/dsh-settings').catch(() => null),
  ])
    .then(([schemastery, settings]) => {
      if (disposed) return
      if (!schemastery || !settings || typeof settings.installSettingsSection !== 'function') {
        log(cfg.debug, 'settings surface unavailable; skipping section registration')
        return
      }
      try {
        const Config = schemastery.object({
          backendUrl: schemastery.string().default(CONFIG_DEFAULTS.backendUrl),
          pageSize: schemastery.number().step(1).min(1).max(50).default(CONFIG_DEFAULTS.pageSize),
          requestTimeoutMs: schemastery.number().step(1).min(1000).max(60000).default(CONFIG_DEFAULTS.requestTimeoutMs),
          uiSlot: schemastery.string().default(CONFIG_DEFAULTS.uiSlot),
          providerIdPrefix: schemastery.string().default(CONFIG_DEFAULTS.providerIdPrefix),
          proxyPort: schemastery.number().step(1).min(1024).max(65535).default(CONFIG_DEFAULTS.proxyPort),
          debug: schemastery.boolean().default(false),
        })
        const disposer = settings.installSettingsSection(ctx, SECTION_NS, Config, cfg, {
          setSource: (current) => { sectionSource = () => current || {} },
          onChange: (current) => { sectionSource = () => current || {} },
        })
        if (typeof disposer === 'function') sectionDispose = disposer
        log(cfg.debug, `settings section "${SECTION_NS}" registered`)
      } catch (error) {
        log(cfg.debug, 'section registration failed:', error && error.message)
      }
    })
    .catch((error) => {
      if (!disposed) log(cfg.debug, 'optional settings setup skipped:', error && error.message)
    })

  ctx.effect(() => () => {
    disposed = true
    if (typeof sectionDispose === 'function') {
      try {
        sectionDispose()
      } catch { /* cleanup must never throw across unload */ }
    }
    if (proxyServer) {
      try { proxyServer.close() } catch { /* ignore */ }
    }
  })

  log(cfg.debug, `host ready (backendUrl=${cfg.backendUrl || '(not configured)'}, pageSize=${cfg.pageSize}, proxyPort=${cfg.proxyPort})`)
}
