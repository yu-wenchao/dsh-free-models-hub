# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
versions follow [SemVer](https://semver.org/).

## [0.1.0] — 2026-08-26

First release.

### Fixed

- Admin login appeared to "bounce back to the login page" behind Apache with
  directory redirects: POSTing the form to `/admin` hit mod_dir's 301 to
  `/admin/`, downgrading the POST to GET and silently dropping the
  credentials. Every backend-facing URL now carries the trailing slash
  (form actions, auth bounces, logout, canonical map), verified end-to-end
  through a real phpStudy Apache + FCGID + PHP 7.4.3 stack and via a
  Cloudflare Tunnel.

### Added

- Sidebar "free models leaderboard" panel for the DeepSeek Harness web UI:
  server-side pagination (10/page, page window, first/last), expandable rows
  showing API base URL + model name + key-application button.
- One-click custom-provider setup writing the documented
  `llm-pi-ai.providers.<id>` route (openai-completions, gateway-safe compat
  defaults) into user settings; YAML fallback dialog when automated writes are
  unavailable. User API keys never pass through this plugin.
- PHP 7.4 + SQLite companion backend: admin CRUD (title / base URL / model id /
  key application link), enable/disable + ordering, public read-only paginated
  JSON API with strict CORS allowlist, bcrypt login with CSRF + throttling,
  deny-all data directory.
- Single front-controller routing with clean URLs only: `/` public leaderboard
  page, `/api/models` data endpoint, `/admin` backend; direct `*.php` hits are
  canonically redirected or answered 404 and `X-Powered-By` is stripped, so the
  stack stays invisible to visitors. Users configure just the site root — the
  panel appends `/api/models` itself.
- Fixed footer menu: 技术笔记 · 插件开发 · 联系站长 (configurable).
- Floating-drawer degradation path and configurable sidebar slot name for
  resilience against DSH preview-period UI changes.
- Docs set: product plan, technical design, development plan, code-review
  checklist, security review & acceptance matrix, release guide.
- Zero-dependency build (`scripts/build.mjs`) with committed prebuilt `lib/`
  artifacts; installs from GitHub need no pnpm build-script allowance.
- `scripts/installer-contract.cjs` — verifies every installer/client-scanner
  activation condition against an installed copy (11 checks, all passing on
  fresh install and on update-over-install).
- `scripts/deploy-site.ps1` — one-command deployment of `server-php/` to a
  local site root (phpStudy etc.), never touching the live `data/` directory.

### Verified

- Plugin unit tests: 23/23 green (`npm test`).
- Backend end-to-end smoke on real PHP 7.4.3: bootstrap → forced password
  change → CORS exact echo/deny → CRUD → pagination & ordering → stored-XSS
  escaping → non-http(s) scheme stripping at the API boundary → clean-URL
  routing incl. `.php` canonicalization, sensitive-path 404s and missing
  `X-Powered-By` fingerprint.
