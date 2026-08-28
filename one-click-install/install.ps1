<#
  dsh-free-models-hub — 一键安装脚本
  =================================
  自动探测本机 DeepSeek Harness (DSH) 安装位置（桌面版 exe / npm 版均可），
  并把「免费模型榜」插件复制进对应 profile 并激活。

  用法：
    双击 安装.bat，或在 PowerShell 里运行：
      powershell -ExecutionPolicy Bypass -File install.ps1
#>

$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'dsh-free-models-hub 一键安装'

$PluginName = 'dsh-free-models-hub'
$ScriptDir  = $PSScriptRoot
$PluginSrc  = Join-Path $ScriptDir "plugin\$PluginName"

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

function Test-PluginPackage {
    $pkgJson = Join-Path $PluginSrc 'package.json'
    if (-not (Test-Path $pkgJson)) { return $false }
    try {
        $pkg = Get-Content $pkgJson -Raw | ConvertFrom-Json
        if ($pkg.name -ne $PluginName) { return $false }
        if (-not $pkg.dsh.bundle.patch) { return $false }
        if (-not (Test-Path (Join-Path $PluginSrc ($pkg.dsh.bundle.patch)))) { return $false }
        return $true
    } catch { return $false }
}

function Add-JsonArrayItem {
    param($Obj, $Path, $Value)
    $cur = $Obj
    foreach ($k in $Path) {
        if ($null -eq $cur.$k) { $cur | Add-Member -NotePropertyName $k -NotePropertyValue @{} -Force }
        $cur = $cur.$k
    }
    if (-not $cur) { $cur = @() }
    $arr = @($cur | ForEach-Object { $_ })
    if ($arr -notcontains $Value) { $arr += $Value }
    return $arr
}

function Copy-PluginToNodeModules {
    param($Dest)
    if (Test-Path $Dest) { Remove-Item -Recurse -Force $Dest }
    Copy-Item -Recurse -Force $PluginSrc $Dest
    Remove-Item -Recurse -Force (Join-Path $Dest 'node_modules') -ErrorAction SilentlyContinue
}

function Install-IntoProfile {
    param($ProfileDir)
    $nodeModules = Join-Path $ProfileDir 'node_modules'
    $pkgJsonPath = Join-Path $ProfileDir 'package.json'
    if (-not (Test-Path $nodeModules)) {
        # 桌面版常把依赖 hoist 到 home 级共享 node_modules，profile 下可能没有自己的 node_modules。
        # 这里自动创建，避免被静默跳过。
        New-Item -ItemType Directory -Force -Path $nodeModules | Out-Null
        Write-Warn "profile 缺少 node_modules，已自动创建: $nodeModules"
    }
    if (-not (Test-Path $pkgJsonPath)) {
        Write-Warn "profile 缺少 package.json，跳过: $ProfileDir"
        return $false
    }

    # 1) 复制插件包到 node_modules
    $target = Join-Path $nodeModules $PluginName
    try {
        Copy-PluginToNodeModules -Dest $target
    } catch {
        Write-Err "复制插件包失败: $_"
        return $false
    }

    # 2) 注册到 package.json 的 dependencies + dsh.profile.bundles
    try {
        $json = Get-Content $pkgJsonPath -Raw | ConvertFrom-Json
        $changed = $false

        # dependencies.<name>
        if (-not $json.dependencies) { $json | Add-Member -NotePropertyName 'dependencies' -NotePropertyValue @{} -Force }
        if (-not $json.dependencies.$PluginName) {
            # 取插件自身版本号
            $ver = (Get-Content (Join-Path $target 'package.json') -Raw | ConvertFrom-Json).version
            $json.dependencies | Add-Member -NotePropertyName $PluginName -NotePropertyValue $ver -Force
            $changed = $true
        }

        # dsh.profile.bundles
        if (-not $json.dsh) { $json | Add-Member -NotePropertyName 'dsh' -NotePropertyValue @{} -Force }
        if (-not $json.dsh.profile) { $json.dsh | Add-Member -NotePropertyName 'profile' -NotePropertyValue @{} -Force }
        if (-not $json.dsh.profile.bundles) { $json.dsh.profile | Add-Member -NotePropertyName 'bundles' -NotePropertyValue @() -Force }
        $bundles = @($json.dsh.profile.bundles | ForEach-Object { $_ })
        if ($bundles -notcontains $PluginName) { $bundles += $PluginName; $changed = $true }
        $json.dsh.profile.bundles = $bundles

        if ($changed) {
            $jsonStr = $json | ConvertTo-Json -Depth 20
            # 必须无 BOM 写回:node 的 JSON.parse 会因 BOM 抛错,Set-Content -utf8 会加 BOM
            [System.IO.File]::WriteAllText($pkgJsonPath, $jsonStr, (New-Object System.Text.UTF8Encoding($false)))
            Write-Ok "已在 package.json 注册 (dependencies + dsh.profile.bundles)"
        } else {
            Write-Ok "package.json 已包含该插件，无需改动"
        }
        return $true
    } catch {
        Write-Err "修改 package.json 失败: $_"
        return $false
    }
}

Write-Host ''
Write-Host '==============================================' -ForegroundColor Magenta
Write-Host '  dsh-free-models-hub 一键安装' -ForegroundColor Magenta
Write-Host '  免费模型榜 · DeepSeek Harness 社区插件' -ForegroundColor Magenta
Write-Host '==============================================' -ForegroundColor Magenta

# 0) 校验随包自带的插件包
Write-Step '检查安装包内容'
if (-not (Test-Path $PluginSrc)) {
    Write-Err "找不到插件包目录: $PluginSrc"
    Write-Err '请把整个文件夹（安装.bat + plugin 文件夹）放在一起，不要拆开。'
    Read-Host '按回车键退出'
    exit 1
}
if (-not (Test-Path (Join-Path $PluginSrc 'package.json'))) {
    Write-Err '插件包缺少 package.json'
    Read-Host '按回车键退出'
    exit 1
}
if (-not (Test-Path (Join-Path $PluginSrc 'lib'))) {
    Write-Err '插件包缺少 lib 目录'
    Read-Host '按回车键退出'
    exit 1
}
Write-Ok '安装包完整'

# 1) 探测 DSH 安装位置（去重）
Write-Step '正在探测本机 DeepSeek Harness 安装位置...'
$script:homes = @()
function Add-Home($h) {
    if ($h -and (Test-Path $h) -and ($script:homes -notcontains $h)) { $script:homes += $h }
}
# a) 环境变量 DSH_HOME
Add-Home $env:DSH_HOME
# b) 默认 ~/.dsh
Add-Home (Join-Path $HOME '.dsh')
# c) 各固定盘符下搜 dsh-home 目录 或 DeepSeekHarness.exe
$drives = [System.IO.DriveInfo]::GetDrives() | Where-Object { $_.DriveType -eq 'Fixed' -and $_.IsReady }
foreach ($d in $drives) {
    $root = $d.RootDirectory.FullName
    try {
        $dshHome = Join-Path $root 'dsh-home'
        if (Test-Path $dshHome) { Add-Home $dshHome }
        # 桌面版 exe 所在目录的 dsh-home
        Get-ChildItem -Path $root -Filter 'DeepSeekHarness.exe' -Depth 2 -ErrorAction SilentlyContinue | ForEach-Object {
            $exeHome = Join-Path $_.DirectoryName 'dsh-home'
            if (Test-Path $exeHome) { Add-Home $exeHome }
        }
    } catch { }
}

if ($script:homes.Count -eq 0) {
    Write-Err '没有找到 DeepSeek Harness 的安装位置。'
    Write-Err '请确认已安装 DeepSeek Harness，或设置环境变量 DSH_HOME 指向其 dsh-home 目录。'
    Read-Host '按回车键退出'
    exit 1
}
foreach ($h in $script:homes) { Write-Ok "发现 DSH: $h" }

# 2) 遍历每个 DSH 的 profiles，安装插件
$installedAny = $false
foreach ($h in $script:homes) {
    $profilesRoot = Join-Path $h 'profiles'
    if (-not (Test-Path $profilesRoot)) {
        Write-Warn "  没有发现 profiles 目录: $profilesRoot"
        continue
    }
    Write-Step "处理 DSH ($h) 的 profiles"
    $profiles = Get-ChildItem $profilesRoot -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -ne 'node_modules' }
    if (-not $profiles) { Write-Warn "  没有发现 profile 目录: $profilesRoot" }
    foreach ($p in $profiles) {
        Write-Host ("  安装到 profile: " + $p.Name)
        $ok = Install-IntoProfile -ProfileDir $p.FullName
        if ($ok) { $installedAny = $true }
    }
    # 兜底：DSH 常把依赖 hoist 到 profiles 级共享 node_modules，所有 profile 都能解析到，补装一份
    $sharedNm = Join-Path $profilesRoot 'node_modules'
    if (-not (Test-Path $sharedNm)) { New-Item -ItemType Directory -Force -Path $sharedNm | Out-Null }
    try {
        Copy-PluginToNodeModules -Dest (Join-Path $sharedNm $PluginName)
        Write-Ok "已补装到共享 node_modules: $sharedNm"
    } catch {
        Write-Warn ("共享 node_modules 补装失败（可忽略）: " + $_.Exception.Message)
    }
}

# 3) 结果
Write-Step '安装结果'
if ($installedAny) {
    Write-Ok '插件已安装！重启 DeepSeek Harness 后，右侧边缘会出现 🎁 按钮。'
    Write-Ok '步骤：1) 完全关闭并重新打开 DeepSeek Harness'
    Write-Ok '      2) 点右侧 🎁 打开「免费模型榜」'
    Write-Ok '      3) 一键配置后到 设置→模型 填你的免费 Key 即可使用'
} else {
    Write-Warn '没有成功安装到任何 profile。请检查上面的提示。'
    Write-Warn '也可手动把「plugin\dsh-free-models-hub」文件夹复制到'
    Write-Warn '  <DSH_HOME>\profiles\<名字>\node_modules\ 下，并在该 profile 的'
    Write-Warn '  package.json 的 dsh.profile.bundles 里加上 dsh-free-models-hub。'
}

Write-Host ''
Read-Host '安装完成，按回车键关闭'
