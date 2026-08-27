<#
  dsh-free-models-hub — 命令行版安装 (npm/CLI 用户)
  =================================================
  通过 dsh CLI + pnpm 把插件装进 profile web。
  需要本机已能用 dsh 命令和 pnpm。
#>

$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'dsh-free-models-hub 命令行版安装'

$PluginSrc = Join-Path $PSScriptRoot 'plugin\dsh-free-models-hub'
$Profile = 'web'

function Write-Ok($msg)  { Write-Host ("  [OK] " + $msg) -ForegroundColor Green }
function Write-Warn($m)  { Write-Host ("  [注意] " + $m) -ForegroundColor Yellow }
function Write-Err($m)   { Write-Host ("  [错误] " + $m) -ForegroundColor Red }

Write-Host ''
Write-Host '==============================================' -ForegroundColor Magenta
Write-Host '  dsh-free-models-hub 命令行版安装 (npm/CLI)' -ForegroundColor Magenta
Write-Host '==============================================' -ForegroundColor Magenta

if (-not (Test-Path $PluginSrc)) {
    Write-Err "找不到插件目录: $PluginSrc（请让本文件和 plugin 文件夹在同一层）"
    Read-Host '按回车键退出'
    exit 1
}

# 检查 dsh
$dsh = Get-Command dsh -ErrorAction SilentlyContinue
if (-not $dsh) {
    Write-Err '没有在 PATH 中找到 dsh 命令。'
    Write-Err '如果你是「命令行版 / npx」方式使用 DSH，请先确保能在命令行里运行 dsh，'
    Write-Warn "然后手动执行下面这一条即可："
    Write-Host ''
    Write-Host ("    dsh plugin --profile $Profile add `"$PluginSrc`"") -ForegroundColor Cyan
    Write-Host ''
    Read-Host '按回车键退出'
    exit 1
}

# 检查 pnpm
$pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
if (-not $pnpm) {
    Write-Err '没有在 PATH 中找到 pnpm（插件安装依赖它）。'
    Write-Err '请先安装 pnpm，或用「桌面版」离线安装器 install-free-models-hub.bat。'
    Read-Host '按回车键退出'
    exit 1
}

Write-Ok "找到 dsh: $($dsh.Source)"
Write-Ok "找到 pnpm: $($pnpm.Source)"
Write-Host ''
Write-Host "正在通过 dsh CLI + pnpm 安装到 profile '$Profile' ..." -ForegroundColor Cyan

& dsh plugin --profile $Profile add "$PluginSrc"
$code = $LASTEXITCODE
Write-Host ''
if ($code -eq 0) {
    Write-Ok '安装命令执行成功！重启 DeepSeek Harness 后，右侧边缘会出现 🎁 按钮。'
} else {
    Write-Warn "安装命令返回非零退出码 ($code)。请查看上方 pnpm 输出判断原因。"
}

Read-Host '按回车键关闭'
