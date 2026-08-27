<#
  dsh-free-models-hub — 一键卸载脚本
  =================================
  自动探测本机 DeepSeek Harness 安装位置，并把「免费模型榜」插件
  从所有 profile 里移除（删除插件文件夹 + 从 package.json 登记中删除）。

  用法：
    双击 卸载.bat / uninstall-free-models-hub.bat，或在 PowerShell 里运行：
      powershell -ExecutionPolicy Bypass -File uninstall.ps1
#>

$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'dsh-free-models-hub 一键卸载'

$PluginName = 'dsh-free-models-hub'

function Write-Step($msg) {
    Write-Host ''
    Write-Host ("[步骤] " + $msg) -ForegroundColor Cyan
}
function Write-Ok($msg) {
    Write-Host ("  [OK] " + $msg) -ForegroundColor Green
}
function Write-Warn($msg) {
    Write-Host ("  [注意] " + $msg) -ForegroundColor Yellow
}
function Write-Err($msg) {
    Write-Host ("  [错误] " + $msg) -ForegroundColor Red
}

function Add-Home($h) {
    if ($h -and (Test-Path $h) -and ($script:homes -notcontains $h)) { $script:homes += $h }
}

function Uninstall-FromProfile {
    param($ProfileDir)
    $nodeModules = Join-Path $ProfileDir 'node_modules'
    $pkgJsonPath = Join-Path $ProfileDir 'package.json'
    if (-not (Test-Path $nodeModules)) { return $false }
    $changed = $false

    # 1) 删除插件文件夹
    $target = Join-Path $nodeModules $PluginName
    if (Test-Path $target) {
        try {
            Remove-Item -Recurse -Force $target
            Write-Ok "已删除插件文件夹: $target"
            $changed = $true
        } catch {
            Write-Err "删除插件文件夹失败: $_"
        }
    }

    # 2) 从 package.json 移除登记
    if (Test-Path $pkgJsonPath) {
        try {
            $json = Get-Content $pkgJsonPath -Raw | ConvertFrom-Json
            $jsonChanged = $false
            # dependencies
            if ($json.dependencies -and $json.dependencies.$PluginName) {
                $json.dependencies.PSObject.Properties.Remove($PluginName)
                $jsonChanged = $true
            }
            # dsh.profile.bundles
            if ($json.dsh -and $json.dsh.profile -and $json.dsh.profile.bundles) {
                $bundles = @($json.dsh.profile.bundles | ForEach-Object { $_ })
                $before = $bundles.Count
                $json.dsh.profile.bundles = @($bundles | Where-Object { $_ -ne $PluginName })
                if ($json.dsh.profile.bundles.Count -ne $before) { $jsonChanged = $true }
            }
            if ($jsonChanged) {
                $jsonStr = $json | ConvertTo-Json -Depth 20
                [System.IO.File]::WriteAllText($pkgJsonPath, $jsonStr, (New-Object System.Text.UTF8Encoding($false)))
                Write-Ok "已从 package.json 移除登记 (dependencies + dsh.profile.bundles)"
            }
        } catch {
            Write-Err "修改 package.json 失败(请手动检查): $_"
        }
    }
    return $changed
}

Write-Host ''
Write-Host '==============================================' -ForegroundColor Magenta
Write-Host '  dsh-free-models-hub 一键卸载' -ForegroundColor Magenta
Write-Host '==============================================' -ForegroundColor Magenta

# 探测 DSH 安装位置
Write-Step '正在探测本机 DeepSeek Harness 安装位置...'
$script:homes = @()
Add-Home $env:DSH_HOME
Add-Home (Join-Path $HOME '.dsh')
$drives = [System.IO.DriveInfo]::GetDrives() | Where-Object { $_.DriveType -eq 'Fixed' -and $_.IsReady }
foreach ($d in $drives) {
    $root = $d.RootDirectory.FullName
    try {
        $dshHome = Join-Path $root 'dsh-home'
        if (Test-Path $dshHome) { Add-Home $dshHome }
        Get-ChildItem -Path $root -Filter 'DeepSeekHarness.exe' -Depth 2 -ErrorAction SilentlyContinue | ForEach-Object {
            $exeHome = Join-Path $_.DirectoryName 'dsh-home'
            if (Test-Path $exeHome) { Add-Home $exeHome }
        }
    } catch { }
}

if ($script:homes.Count -eq 0) {
    Write-Err '没有找到 DeepSeek Harness 的安装位置，无法自动卸载。'
    Read-Host '按回车键退出'
    exit 1
}
foreach ($h in $script:homes) { Write-Ok "发现 DSH: $h" }

# 逐 profile 卸载
$removedAny = $false
foreach ($h in $script:homes) {
    $profilesRoot = Join-Path $h 'profiles'
    if (-not (Test-Path $profilesRoot)) { continue }
    Write-Step "处理 DSH ($h) 的 profiles"
    $profiles = Get-ChildItem $profilesRoot -Directory -ErrorAction SilentlyContinue
    foreach ($p in $profiles) {
        if (-not (Test-Path (Join-Path $p.FullName 'node_modules'))) { continue }
        $had = Test-Path (Join-Path $p.FullName "node_modules\$PluginName")
        $hasEntry = $false
        $pkgJsonPath = Join-Path $p.FullName 'package.json'
        if (Test-Path $pkgJsonPath) {
            try {
                $m = Get-Content $pkgJsonPath -Raw | ConvertFrom-Json
                $hasEntry = ($m.dependencies -and $m.dependencies.$PluginName) -or
                            ($m.dsh -and $m.dsh.profile -and $m.dsh.profile.bundles -contains $PluginName)
            } catch { $hasEntry = $false }
        }
        if ($had -or $hasEntry) {
            Write-Host ("  处理 profile: " + $p.Name)
            $ok = Uninstall-FromProfile -ProfileDir $p.FullName
            if ($ok) { $removedAny = $true }
        }
    }
}

Write-Step '卸载结果'
if ($removedAny) {
    Write-Ok '插件已卸载。完全关闭并重新打开 DeepSeek Harness 即可生效。'
} else {
    Write-Warn '没有找到需要卸载的内容（该插件可能本来就没装）。'
}

Write-Host ''
Read-Host '卸载完成，按回车键关闭'
