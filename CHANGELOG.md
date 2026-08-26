# Changelog

## [0.2.0] 閳?2026-08-26

### Changed

- **Panel mounting redesigned**: the leaderboard now docks as a right-side
  slide-in drawer with its own circular 棣冨返 toggle button on the right edge 閳?  deterministic on every DSH build (no dependence on internal sidebar slot
  layout). Open state persists across reloads; Esc closes.
- Default `uiSlot` is now empty (drawer mode). In-sidebar slot mounting stays
  available as an opt-in via config.
- One-click configure toast now tells users exactly where to paste the key:
  鐠佸墽鐤?閳?濡€崇€?閳?`freehub-*` 閹绘劒绶甸弬?
- Default `backendUrl` points at the author-operated source
  (`https://free-api.gd7.cn`) 閳?the panel works immediately after install.

## [0.1.0] 閳?2026-08-26

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
  stack stays invisible to visitors. Users configure just the site root 閳?the
  panel appends `/api/models` itself.
- Fixed footer menu: 閹垛偓閺堫垳鐟拋?璺?閹绘帊娆㈠鈧崣?璺?閼辨梻閮寸粩娆撴毐 (configurable).
- Floating-drawer degradation path and configurable sidebar slot name for
  resilience against DSH preview-period UI changes.
- Docs set: product plan, technical design, development plan, code-review
  checklist, security review & acceptance matrix, release guide.
- Zero-dependency build (`scripts/build.mjs`) with committed prebuilt `lib/`
  artifacts; installs from GitHub need no pnpm build-script allowance.
- `scripts/installer-contract.cjs` 閳?verifies every installer/client-scanner
  activation condition against an installed copy (11 checks, all passing on
  fresh install and on update-over-install).
- `scripts/deploy-site.ps1` 閳?one-command deployment of `server-php/` to a
  local site root (phpStudy etc.), never touching the live `data/` directory.

### Verified

- Plugin unit tests: 23/23 green (`npm test`).
- Backend end-to-end smoke on real PHP 7.4.3: bootstrap 閳?forced password
  change 閳?CORS exact echo/deny 閳?CRUD 閳?pagination & ordering 閳?stored-XSS
  escaping 閳?non-http(s) scheme stripping at the API boundary 閳?clean-URL
  routing incl. `.php` canonicalization, sensitive-path 404s and missing
  `X-Powered-By` fingerprint.
