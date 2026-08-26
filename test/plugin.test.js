/**
 * Unit tests for dsh-free-models-hub pure core + build artifacts.
 * Run: npm test   (node --test test/)
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  CONFIG_DEFAULTS,
  DEFAULT_FOOTER_LINKS,
  apiKeyEnvName,
  buildProviderEntry,
  clampInt,
  normalizeConfig,
  pageWindow,
  parseModelsResponse,
  providerId,
  safeHttpUrl,
  slugify,
  toYamlSnippet,
} from '../src/core.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)

/* ------------------------------------------------------------ clampInt */

test('clampInt coerces and bounds', () => {
  assert.equal(clampInt('7', 1, 10, 3), 7)
  assert.equal(clampInt(99, 1, 10, 3), 10)
  assert.equal(clampInt(-5, 1, 10, 3), 1)
  assert.equal(clampInt('abc', 1, 10, 3), 3)
  assert.equal(clampInt(2.9, 1, 10, 3), 2)
})

/* ---------------------------------------------------------- safeHttpUrl */

test('safeHttpUrl accepts only absolute http/https', () => {
  assert.equal(safeHttpUrl('https://a.b/v1'), 'https://a.b/v1')
  assert.equal(safeHttpUrl('http://127.0.0.1:8080/api'), 'http://127.0.0.1:8080/api')
  assert.equal(safeHttpUrl('javascript:alert(1)'), '')
  assert.equal(safeHttpUrl('data:text/html,x'), '')
  assert.equal(safeHttpUrl('file:///c:/win'), '')
  assert.equal(safeHttpUrl('not a url'), '')
  assert.equal(safeHttpUrl(''), '')
  assert.equal(safeHttpUrl(null), '')
  assert.equal(safeHttpUrl('https://a.b/' + 'x'.repeat(3000)), '')
})

test('safeHttpUrl returns the canonical parsed URL (smuggling-proof)', () => {
  // What we validate is exactly what we use: control characters that the
  // WHATWG parser strips can never survive into the value callers consume.
  assert.equal(safeHttpUrl(' https://ok.example '), 'https://ok.example/')
  assert.equal(safeHttpUrl('https://ok.example/\nEvil'), 'https://ok.example/Evil')
  assert.equal(safeHttpUrl('https://host/\\evil'), 'https://host//evil') // backslash normalizes to '/'
})

/* -------------------------------------------------------------- slugs */

test('slugify produces stable lowercase fragments', () => {
  assert.equal(slugify('GLM-5 Flash 免费额度'), 'glm-5-flash')
  assert.equal(slugify('  --Qwen3 Coder!!--  '), 'qwen3-coder')
  assert.equal(slugify('免费模型'), 'model') // no ascii left -> fallback
  assert.equal(slugify('A'.repeat(100)), 'a'.repeat(40))
  assert.equal(slugify('x-y-'), 'x-y')
  assert.equal(slugify(null), 'model')
})

test('providerId uses validated prefix and stays idempotent', () => {
  assert.equal(providerId('freehub', 'GLM-5 Flash'), 'freehub-glm-5-flash')
  assert.equal(providerId('Bad Prefix', 'm'), 'freehub-m')
  assert.equal(providerId(undefined, 'm'), 'freehub-m')
  assert.equal(providerId('kimi', 'K2 免费'), 'kimi-k2')
})

test('apiKeyEnvName yields valid env identifiers', () => {
  assert.equal(apiKeyEnvName('freehub-glm-5-flash'), 'FREEHUB_GLM_5_FLASH_API_KEY')
  assert.equal(apiKeyEnvName('freehub-模型'), 'FREEHUB_API_KEY') // non-ascii collapses, no double underscores
  assert.equal(apiKeyEnvName('9lives'), 'X9LIVES_API_KEY') // cannot start with digit
  assert.equal(apiKeyEnvName(''), 'MODEL_API_KEY')
})

/* ------------------------------------------------------ normalizeConfig */

test('normalizeConfig fills defaults on empty input', () => {
  const { value, warnings } = normalizeConfig({})
  assert.deepEqual(value.footerLinks.map((l) => l.label), DEFAULT_FOOTER_LINKS.map((l) => l.label))
  assert.equal(value.pageSize, CONFIG_DEFAULTS.pageSize)
  assert.equal(warnings.length, 0)
  assert.equal(value.backendUrl, '')
})

test('normalizeConfig normalizes backendUrl and strips trailing slashes', () => {
  const { value } = normalizeConfig({ backendUrl: 'https://site.com/fmh///' })
  assert.equal(value.backendUrl, 'https://site.com/fmh')
})

test('normalizeConfig warns and falls back per-field without throwing', () => {
  const { value, warnings } = normalizeConfig({
    backendUrl: 'ftp://nope',
    pageSize: 9999,
    uiSlot: '',
    providerIdPrefix: '1bad',
    footerLinks: [{ label: 'ok', url: 'https://ok' }, { label: 'x', url: 'javascript:' }],
    debug: true,
  })
  assert.equal(value.backendUrl, '')
  assert.equal(value.pageSize, 50) // clamped, not defaulted
  assert.equal(value.uiSlot, CONFIG_DEFAULTS.uiSlot)
  assert.equal(value.providerIdPrefix, 'freehub')
  assert.equal(value.footerLinks.length, 1)
  assert.equal(value.debug, true)
  assert.ok(warnings.length >= 4)
})

test('normalizeConfig keeps custom slot and links', () => {
  const { value, warnings } = normalizeConfig({
    uiSlot: 'sidebar.settings',
    footerLinks: [{ label: '博客', url: 'http://blog.4wc.cn' }],
  })
  assert.equal(value.uiSlot, 'sidebar.settings')
  assert.equal(value.footerLinks.length, 1)
  assert.equal(warnings.length, 0)
})

/* ----------------------------------------------------------- pageWindow */

test('pageWindow shows all pages when total <= width', () => {
  assert.deepEqual(pageWindow(1, 1), [1])
  assert.deepEqual(pageWindow(3, 7), [1, 2, 3, 4, 5, 6, 7])
  assert.deepEqual(pageWindow(0, 5), [1, 2, 3, 4, 5]) // clamped
})

test('pageWindow hugs the left edge near page one', () => {
  assert.deepEqual(pageWindow(1, 12), [1, 2, 3, 4, 5, 6, '…', 12])
  assert.deepEqual(pageWindow(2, 12), [1, 2, 3, 4, 5, 6, '…', 12])
  assert.deepEqual(pageWindow(4, 12), [1, 2, 3, 4, 5, 6, '…', 12])
})

test('pageWindow slides a centered mid-window through the middle', () => {
  assert.deepEqual(pageWindow(5, 12), [1, '…', 3, 4, 5, 6, 7, '…', 12])
  assert.deepEqual(pageWindow(6, 12), [1, '…', 4, 5, 6, 7, 8, '…', 12])
  assert.deepEqual(pageWindow(7, 12), [1, '…', 5, 6, 7, 8, 9, '…', 12])
  assert.deepEqual(pageWindow(8, 12), [1, '…', 6, 7, 8, 9, 10, '…', 12])
})

test('pageWindow hugs the right edge near the last page', () => {
  assert.deepEqual(pageWindow(9, 12), [1, '…', 7, 8, 9, 10, 11, 12])
  assert.deepEqual(pageWindow(11, 12), [1, '…', 7, 8, 9, 10, 11, 12])
  assert.deepEqual(pageWindow(12, 12), [1, '…', 7, 8, 9, 10, 11, 12])
})

test('pageWindow never exceeds width page buttons and keeps endpoints', () => {
  for (let tot = 1; tot <= 60; tot++) {
    for (let cur = 1; cur <= tot + 2; cur++) {
      const pages = pageWindow(Math.min(cur, tot), tot)
      assert.equal(pages.at(-1), tot, `last must be ${tot} (tot=${tot}, cur=${cur})`)
      assert.equal(pages[0], 1, `first must be 1 (tot=${tot}, cur=${cur})`)
      const buttons = pages.filter((p) => p !== '…').length
      assert.ok(buttons <= 7 && buttons >= 1, `button budget violated (tot=${tot}, cur=${cur}) -> ${pages}`)
      const seen = new Set(pages.filter((p) => p !== '…'))
      assert.equal(seen.size, buttons, 'duplicate page buttons')
    }
  }
})

/* -------------------------------------------------- buildProviderEntry */

test('buildProviderEntry mirrors documented route shape', () => {
  const { pid, entry } = buildProviderEntry({
    prefix: 'freehub',
    title: 'GLM-5 Flash 免费额度',
    apiBase: 'https://gw.example/v1',
    modelId: 'glm-5-flash',
  })
  assert.equal(pid, 'freehub-glm-5-flash')
  assert.equal(entry.api, 'openai-completions')
  assert.equal(entry.baseURL, 'https://gw.example/v1')
  assert.equal(entry.apiKeyEnv, 'FREEHUB_GLM_5_FLASH_API_KEY')
  assert.equal(entry.compat.supportsDeveloperRole, false)
  assert.equal(entry.compat.maxTokensField, 'max_tokens')
  assert.deepEqual(entry.models, [{ id: 'glm-5-flash' }])
})

test('toYamlSnippet round-trips the essential keys', () => {
  const { pid, entry } = buildProviderEntry({
    prefix: 'freehub',
    title: 'K2 Free',
    apiBase: 'https://gw.example/v1"onload=x', // hostile string must be quoted safely
    modelId: 'k2',
  })
  const yaml = toYamlSnippet({ pid, entry })
  assert.match(yaml, /^llm-pi-ai:\n {2}providers:\n {4}freehub-k2-free:/)
  assert.match(yaml, /baseURL: "https:\/\/gw\.example\/v1\\"onload=x"/)
  assert.match(yaml, /supportsDeveloperRole: false/)
  assert.match(yaml, /- id: "k2"/)
})

/* -------------------------------------------------- parseModelsResponse */

function payload(overrides = {}) {
  return {
    ok: true,
    page: 1,
    page_size: 10,
    total: 2,
    total_pages: 1,
    items: [
      { id: 1, title: 'A', api_base_url: 'https://a/v1', model_name: 'a', key_apply_url: 'https://reg/a' },
      { id: 2, title: 'B', api_base_url: 'https://b/v1', model_name: 'b', key_apply_url: '' },
    ],
    ...overrides,
  }
}

test('parseModelsResponse maps to canonical items and tolerates missing key link', () => {
  const out = parseModelsResponse(payload(), 10)
  assert.equal(out.total, 2)
  assert.equal(out.items.length, 2)
  assert.deepEqual(out.items[0], { id: 1, title: 'A', apiBase: 'https://a/v1', modelId: 'a', keyUrl: 'https://reg/a' })
  assert.equal(out.items[1].keyUrl, '')
})

test('parseModelsResponse drops malformed rows and unsafe urls', () => {
  const out = parseModelsResponse(payload({
    items: [
      null,
      { id: 'x', title: 'no-id', api_base_url: 'https://a', model_name: 'm' },
      { id: 3, title: '', api_base_url: 'https://a', model_name: 'm' },
      { id: 4, title: 'js-url', api_base_url: 'javascript:x', model_name: 'm' },
      { id: 5, title: 'good', api_base_url: ' https://good/v1 ', model_name: ' m ', key_apply_url: 'javascript:y' },
    ],
    total: 9,
    total_pages: 3,
    page: 2,
    page_size: 500,
  }), 10)
  assert.equal(out.total, 9)
  assert.equal(out.totalPages, 3)
  assert.equal(out.page, 2)
  assert.equal(out.pageSize, 50) // clamped server-side contract 1..50
  assert.equal(out.items.length, 1)
  assert.equal(out.items[0].apiBase, 'https://good/v1')
  assert.equal(out.items[0].keyUrl, '')
})

test('parseModelsResponse rejects non-ok payloads', () => {
  assert.throws(() => parseModelsResponse({ ok: false }, 10), TypeError)
  assert.throws(() => parseModelsResponse(null, 10), TypeError)
  assert.throws(() => parseModelsResponse('nope', 10), TypeError)
})

/* ------------------------------------------------------- build artifacts */

test('lib/client.cjs exposes the plugin triple and matches sources', async () => {
  const client = require(join(root, 'lib', 'client.cjs'))
  assert.equal(client.name, 'free-models-hub-client')
  assert.deepEqual(client.inject, ['slots'])
  assert.equal(typeof client.apply, 'function')

  const src = await readFile(join(root, 'src', 'client', 'index.js'), 'utf8')
  assert.doesNotMatch(src.replace(/\/\*[\s\S]*?\*\//g, ''), /^\s*import\s/m, 'client half must stay dependency-free')
})

test('host entry imports standalone and exposes name/apply', async () => {
  const host = await import('../lib/index.js')
  assert.equal(host.name, 'free-models-hub')
  assert.equal(typeof host.apply, 'function')
})

test('package.json carries the activation-critical dsh fields', async () => {
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
  assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml')
  assert.equal(pkg.dsh.client.platform, 'web')
  assert.equal(pkg.exports['./client'], './lib/client.cjs')
  const patch = await readFile(join(root, 'cordis.patch.yml'), 'utf8')
  assert.match(patch, /name:\s*dsh-free-models-hub/)
})
