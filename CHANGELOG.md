# Changelog

## [Unreleased] – 2026-08-27

### Fixed (v0.3.2 in progress)

- **Provider writes no longer wipe existing providers (critical)**: `readProviders` now
  awaits DSH `settingsScope.load()` before reading `snapshot().value.providers`. Previously
  reads happened before the async load finished, returning `{}`, and every one-click / batch
  write replaced all providers with an empty list. Affected paths rewritten to async:
  `applyProvider`, `writeProviderEnsure`, `batchApplyAll`, `saveKeyPool`, `disableKeyPool`,
  and the startup baseURL fix.
- **Removed all hand-rolled `settings.yaml` read/write** from the host and deleted the dead
  `/p/read-providers`, `/p/save-provider`, `/p/save-providers-batch` endpoints. Provider
  writes now go exclusively through DSH's official `settingsScope`, so `settings.yaml` can
  never be corrupted by the plugin (previously caused `BAD_INDENT` / `UNEXPECTED_TOKEN` and
  DSH crashes).
- **Proxy request body handling**: buffer the full request body and set a correct
  `content-length`, drop `transfer-encoding`, removing upstream hangs / `502` on multi-key
  rotation.
- **`writePoolFile` guard**: refuses to overwrite a non-empty key-pool file with an empty
  one, preventing data loss.
- **Multi-key providers pass the DSH credential check**: the host sets placeholder env vars
  for every pooled provider at startup so DSH no longer reports "no credential".

### Added

- **First-use tutorial UI**: a collapsible 「📖 使用教程」 box in the panel walks new users
  through configure → paste key → use (localStorage-persisted open state).
- `docs/07-修复清单.md` — full bug log with root-cause analysis and regression checklist.

## [0.3.1] – 2026-08-26

### Fixed

- PID collision avoidance, multi-model per row, admin sort bug, refresh/upgrade flow.

## [0.3.0] – 2026-08-26

### Added

- **Batch configure**: 「⚡ 配置本页全部」 one-click writes every model on the page into DSH
  `Settings → Models`.
- **Multi-key rotation proxy**: 「🔄 多 Key 轮换」 accepts multiple free keys per model; a local
  127.0.0.1 proxy (port `8787`) round-robins them and fails over automatically.
- Badge/pinned rows support from the leaderboard.

## [0.2.2] – 2026-08-26

### Fixed

- Declare the `settingsScope` inject so one-click provider writes work.

## [0.2.1] – 2026-08-26

### Fixed

- Register the client factory via `__ModuleLoader__.load` (lazy-CJS contract) so the panel
  mounts on fresh DSH builds.

## [0.2.0] – 2026-08-26

### Changed

- **Panel mounting redesigned**: the leaderboard now docks as a right-edge slide-in drawer
  with its own circular 🎁 toggle button — deterministic on every DSH build (no dependence on
  internal sidebar slot layout). Open state persists across reloads; Esc closes.
- Default `uiSlot` is now empty (drawer mode); in-sidebar slot mounting stays available as an
  opt-in via config.
- One-click configure toast now points users to `Settings → Models` → `freehub-*`.
- Default `backendUrl` is the author-operated source (`https://free-api.gd7.cn`) so the panel
  works immediately after install.

## [0.1.0] – 2026-08-26

First release:

### Added

- Sidebar "free models leaderboard" panel: server-side pagination (10/page, page window,
  first/last), expandable rows showing API base URL + model name + key-application button.
- One-click custom-provider setup writing the documented `llm-pi-ai.providers.<id>` route
  (openai-completions, gateway-safe compat defaults) into user settings; YAML fallback dialog
  when automated writes are unavailable. User API keys never pass through this plugin.
- PHP 7.4 + SQLite companion backend: admin CRUD, enable/disable + ordering, public read-only
  paginated JSON API with strict CORS allowlist, bcrypt login with CSRF + throttling,
  deny-all data directory.
- Single front-controller routing with clean URLs only (`/`, `/api/models`, `/admin`);
  direct `*.php` hits are canonically redirected or answered 404 and `X-Powered-By` is
  stripped so the stack stays invisible.
- Fixed footer menu (configurable).
- Floating-drawer degradation path and configurable sidebar slot name for resilience against
  DSH preview-period UI changes.
- Docs set: product plan, technical design, development plan, code-review checklist, security
  review & acceptance matrix, release guide.
- Zero-dependency build (`scripts/build.mjs`) with committed prebuilt `lib/` artifacts;
  installs from GitHub need no pnpm build-script allowance.

### Fixed

- Admin login "bounce back" behind Apache directory redirects (all backend-facing URLs carry
  the trailing slash), verified end-to-end on phpStudy Apache + FCGID + PHP 7.4.3.
