#Requires -Version 5.1
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = 'C:\ProgramData\MercadoDoVale\printer-service'
$scripts = Join-Path $root 'scripts'
$entry = Join-Path $scripts 'shopee-auto-print.cjs'
$core = Join-Path $scripts 'shopee-label-core.cjs'
$manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'manifest.json') -Raw | ConvertFrom-Json
$node = (Get-Command node.exe -ErrorAction Stop).Source
$pm2 = (Get-Command pm2.cmd -ErrorAction Stop).Source

foreach ($file in @('shopee-label-core.cjs', 'verify-shopee-label-margin.cjs')) {
    $source = Join-Path $PSScriptRoot $file
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "Pacote incompleto: $file" }
    $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $source).Hash.ToLowerInvariant()
    if ($actual -ne ([string]$manifest.files.$file).ToLowerInvariant()) { throw "Hash invalido: $file" }
    & $node --check $source
    if ($LASTEXITCODE -ne 0) { throw "Sintaxe invalida: $file" }
}
if (-not (Test-Path -LiteralPath $entry -PathType Leaf)) { throw 'Servico Shopee nao instalado.' }

$script = Get-Content -LiteralPath $entry -Raw
$functionStart = $script.IndexOf('async function expandShopeeLabelForThermalPaper(pdfBuffer) {')
$nextFunction = if ($functionStart -ge 0) { $script.IndexOf('async function createThermalTestPdf', $functionStart) } else { -1 }
$alreadyUsesCore = $script.Contains("require('./shopee-label-core.cjs')")
if (-not $alreadyUsesCore -and ($functionStart -lt 0 -or $nextFunction -lt 0)) {
    throw 'Funcao de ajuste da etiqueta Shopee nao localizada; instalacao cancelada.'
}

$backup = Join-Path 'C:\ProgramData\MercadoDoVale\printer-service.restore-points' ('shopee-label-margin-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Force -Path $backup | Out-Null
Copy-Item -LiteralPath $entry -Destination (Join-Path $backup 'shopee-auto-print.cjs') -Force
$coreExisted = Test-Path -LiteralPath $core -PathType Leaf
if ($coreExisted) { Copy-Item -LiteralPath $core -Destination (Join-Path $backup 'shopee-label-core.cjs') -Force }

$mutated = $false
try {
    $mutated = $true
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'shopee-label-core.cjs') -Destination $core -Force
    if (-not $alreadyUsesCore) {
        $delegation = @"
async function expandShopeeLabelForThermalPaper(pdfBuffer) {
    return require('./shopee-label-core.cjs').expandShopeeLabelForThermalPaper(pdfBuffer);
}

"@
        $script = $script.Substring(0, $functionStart) + $delegation + $script.Substring($nextFunction)
        [IO.File]::WriteAllText($entry, $script, [Text.UTF8Encoding]::new($false))
    }
    & $node --check $entry
    if ($LASTEXITCODE -ne 0) { throw 'Sintaxe do servico Shopee invalida.' }
    & $node (Join-Path $PSScriptRoot 'verify-shopee-label-margin.cjs') $root
    if ($LASTEXITCODE -ne 0) { throw 'Validacao do PDF Shopee falhou.' }
    & $pm2 restart shopee-auto-print
    if ($LASTEXITCODE -ne 0) { throw 'PM2 nao reiniciou a impressao.' }
    & $pm2 save
    if ($LASTEXITCODE -ne 0) { throw 'PM2 nao salvou os processos.' }
    Start-Sleep -Seconds 5
    $probe = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8081/printers' -TimeoutSec 15
    if ([int]$probe.StatusCode -ne 200) { throw 'Painel de impressao local nao respondeu.' }
    Write-Host "ATUALIZACAO CONCLUIDA: Shopee com margem direita de 5 mm. Mercado Livre e TikTok preservados. Backup: $backup" -ForegroundColor Green
} catch {
    if ($mutated) {
        Copy-Item -LiteralPath (Join-Path $backup 'shopee-auto-print.cjs') -Destination $entry -Force
        if ($coreExisted) { Copy-Item -LiteralPath (Join-Path $backup 'shopee-label-core.cjs') -Destination $core -Force }
        elseif (Test-Path -LiteralPath $core) { Remove-Item -LiteralPath $core -Force }
        & $pm2 restart shopee-auto-print | Out-Null
        & $pm2 save | Out-Null
    }
    throw
}
