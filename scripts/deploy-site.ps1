<#
.SYNOPSIS
  Deploy the free-models-hub backend (server-php contents) to a local site root,
  e.g. a phpStudy website directory:  D:\phpstudy_pro\WWW
  (or a dedicated site root you created for free-api.gd7.cn).

.DESCRIPTION
  - Copies the CONTENTS of server-php\ into the target directory.
  - Never touches <target>\data\ : your live SQLite database and admin password
    survive every re-deploy (this is how you ship future updates too).
  - Safe to run repeatedly.

.USAGE
  powershell -ExecutionPolicy Bypass -File scripts\deploy-site.ps1 -Target "D:\phpstudy_pro\WWW"

  After deploying:
    1. Open  https://free-api.gd7.cn/diag.php   -> check every line, then DELETE diag.php
    2. Open  https://free-api.gd.cn/admin        -> first visit shows the one-time admin password
    3. If /admin 404s but /admin/index.php works -> enable pseudo-static (伪静态)
       for the site in phpStudy, or set AllowOverride All in the vhost <Directory> block.
#>
param(
    [Parameter(Mandatory = $true)]
    [string]$Target
)

$ErrorActionPreference = 'Stop'
$src = Join-Path $PSScriptRoot '..\server-php'
$src = [System.IO.Path]::GetFullPath($src)

if (-not (Test-Path -LiteralPath (Join-Path $src 'index.php'))) {
    throw "source looks wrong: $src"
}
if (-not (Test-Path -LiteralPath $Target)) {
    New-Item -ItemType Directory -Force -Path $Target | Out-Null | ForEach-Object {}
}

Write-Host "Deploying:"
Write-Host "  from: $src"
Write-Host "  to  : $Target"
Write-Host "  (data\ is excluded — your database stays untouched)"

robocopy $src $Target /E /XD data /XF *.log /NFL /NDL /NJH /NJS /NP
if ($LASTEXITCODE -ge 8) {
    throw "robocopy failed with exit code $LASTEXITCODE"
}

Write-Host ""
Write-Host "Done. Next steps:"
Write-Host "  1. open https://free-api.gd7.cn/diag.php  (verify, then DELETE diag.php!)"
Write-Host "  2. open https://free-api.gd7.cn/admin     (save the one-time password)"
Write-Host "  3. admin -> 系统设置 -> CORS 允许来源 填你的 DSH 页面来源，如 http://127.0.0.1:3080"
Write-Host "  4. DSH 插件面板「配置数据源」里填 https://free-api.gd7.cn"
exit 0
