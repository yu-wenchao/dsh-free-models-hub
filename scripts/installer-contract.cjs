/**
 * Installer-contract check: verifies every activation condition the DSH
 * installer (dsh plugin add) and client-modules scanner rely on, run against
 * an installed copy of the package (node_modules/dsh-free-models-hub).
 * Usage: node installer-contract.cjs <path-to-installed-package>
 */
const fs = require('fs')
const path = require('path')
const root = process.argv[2]
if (!root || !fs.existsSync(root)) { console.error('usage: node installer-contract.cjs <pkg-dir>'); process.exit(2) }

let pass = 0, fail = 0
const t = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + '  ' + name); ok ? pass++ : fail++ }

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
t('dsh.bundle.patch declared (missing = installs but never activates)', !!(pkg.dsh && pkg.dsh.bundle && pkg.dsh.bundle.patch))
const patchPath = path.join(root, pkg.dsh.bundle.patch)
t('patch file ships in the package', fs.existsSync(patchPath))
const patch = fs.readFileSync(patchPath, 'utf8')
t('patch references the entry by package name', /name:\s*dsh-free-models-hub/.test(patch))
const host = require(path.join(root, 'lib', 'index.js'))
t('host entry loads and exports name/apply', host.name === 'free-models-hub' && typeof host.apply === 'function')
const clientRel = pkg.exports && pkg.exports['./client']
t('exports["./client"] declared', !!clientRel)
const clientAbs = path.join(root, clientRel)
t('client bundle ships in the package', fs.existsSync(clientAbs))
// The served script registers via __ModuleLoader__ (lazy-CJS model).
let registered = null
globalThis.window = { __ModuleLoader__: { load: (def) => { registered = def } } }
try { require(clientAbs) } catch (e) { t('client bundle executes without throwing', false) }
delete globalThis.window
t('client bundle registers via __ModuleLoader__.load', !!registered && registered.id === 'dsh-free-models-hub')
let client = null
try { client = registered.factory(() => { throw new Error('no requires expected') }) } catch (e) { t('client factory materializes', false) }
t('client exports name/inject/apply triple', !!client && client.name === 'free-models-hub-client' && Array.isArray(client.inject) && client.inject.includes('slots') && client.inject.includes('settingsScope') && typeof client.apply === 'function')
t('dsh.client.platform = web (client-modules scan condition)', !!(pkg.dsh && pkg.dsh.client && pkg.dsh.client.platform === 'web'))
t('zero runtime dependencies (offline installable)', Object.keys(pkg.dependencies || {}).length === 0)
t('no prepare build script (no pnpm allowBuilds prompt)', !(pkg.scripts && pkg.scripts.prepare))
t('files field keeps npm publish minimal', Array.isArray(pkg.files) && pkg.files.includes('lib') && pkg.files.includes('cordis.patch.yml'))

console.log(fail === 0 ? 'ALL ' + pass + ' CONTRACT CHECKS PASSED' : fail + ' CHECKS FAILED')
process.exit(fail === 0 ? 0 : 1)
