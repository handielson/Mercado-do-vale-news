#Requires -Version 5.1
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = 'C:\ProgramData\MercadoDoVale\printer-service\scripts'
$entry = Join-Path $root 'shopee-auto-print.cjs'
$core = Join-Path $root 'mercado-livre-print-core.cjs'
$agent = Join-Path $root 'tiktok-shop-print-agent.cjs'
$manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'manifest.json') -Raw | ConvertFrom-Json
$node = (Get-Command node.exe -ErrorAction Stop).Source
$pm2 = (Get-Command pm2.cmd -ErrorAction Stop).Source
foreach ($file in @('tiktok-shop-print-agent.cjs','mercado-livre-print-core.cjs')) {
    $source = Join-Path $PSScriptRoot $file
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "Pacote incompleto: $file" }
    $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $source).Hash.ToLowerInvariant()
    if ($actual -ne ([string]$manifest.files.$file).ToLowerInvariant()) { throw "Hash invalido: $file" }
    & $node --check $source
    if ($LASTEXITCODE -ne 0) { throw "Sintaxe invalida: $file" }
}
if (-not (Test-Path -LiteralPath $entry -PathType Leaf)) { throw 'Servico Shopee nao instalado.' }
if (-not (Test-Path -LiteralPath $core -PathType Leaf)) { throw 'Modulo do comprovante Mercado Livre nao instalado.' }
$coreHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $core).Hash.ToLowerInvariant()
if ($coreHash -ne ([string]$manifest.previousCoreHash).ToLowerInvariant() -and
    $coreHash -ne ([string]$manifest.files.'mercado-livre-print-core.cjs').ToLowerInvariant()) {
    throw "Modulo do comprovante mudou; instalacao cancelada. Hash: $coreHash"
}
$script = Get-Content -LiteralPath $entry -Raw
if ($script -notmatch 'startMercadoLivrePrintAgent' -or $script -notmatch 'const VPS_API_URL' -or
    $script -notmatch 'const VPS_SYNC_KEY' -or $script -notmatch 'async function getCompanySettings' -or
    $script -notmatch 'async function callVpsShopeeAction') {
    throw 'Ponto de entrada instalado nao tem a estrutura esperada; instalacao cancelada.'
}
$bootstrap = @'

// TikTok Shop: consumidor independente; preserva os fluxos Shopee e Mercado Livre.
try {
    require('./tiktok-shop-print-agent.cjs').startTikTokPrintAgent({
        apiUrl: VPS_API_URL, syncKey: VPS_SYNC_KEY, getSettings: getCompanySettings,
        getStockLocations: async (skus) => {
            if (!skus.length) return {};
            const result = await callVpsShopeeAction('get_stock_locations', { skus });
            return Object.fromEntries((result.data?.items || []).map(item => [
                String(item.sku || '').toUpperCase(), (item.locations || []).filter(Boolean).join(' | '),
            ]));
        },
    });
} catch (error) {
    console.error('TikTok Shop Auto Print: inicializacao falhou:', error.message);
}
'@
$backup = Join-Path 'C:\ProgramData\MercadoDoVale\printer-service.restore-points' ('tiktok-shop-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Force -Path $backup | Out-Null
foreach ($file in @($entry,$core,$agent)) {
    if (Test-Path -LiteralPath $file) { Copy-Item -LiteralPath $file -Destination (Join-Path $backup (Split-Path $file -Leaf)) -Force }
}
$mutated = $false
try {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'mercado-livre-print-core.cjs') -Destination $core -Force
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'tiktok-shop-print-agent.cjs') -Destination $agent -Force
    if ($script -notmatch "require\('./tiktok-shop-print-agent.cjs'\)") {
        [IO.File]::AppendAllText($entry, $bootstrap, [Text.UTF8Encoding]::new($false))
    }
    $mutated = $true
    & $node --check $entry
    if ($LASTEXITCODE -ne 0) { throw 'Sintaxe do servico instalado invalida.' }
    & $pm2 restart shopee-auto-print
    if ($LASTEXITCODE -ne 0) { throw 'PM2 nao reiniciou a impressao.' }
    & $pm2 save
    if ($LASTEXITCODE -ne 0) { throw 'PM2 nao salvou os processos.' }
    Start-Sleep -Seconds 5
    $probe = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8081/printers' -TimeoutSec 15
    if ([int]$probe.StatusCode -ne 200) { throw 'Painel de impressao local nao respondeu.' }
    $logs = (& $pm2 logs shopee-auto-print --nostream --lines 180 2>&1 | Out-String)
    if ($logs -notmatch 'TikTok Shop Auto Print: consulta a cada 60 segundos') { throw 'Consumidor TikTok nao confirmado no PM2.' }
    Write-Host "ATIVACAO CONCLUIDA: TikTok, Shopee e Mercado Livre ativos. Backup: $backup" -ForegroundColor Green
} catch {
    if ($mutated) {
        foreach ($file in @($entry,$core,$agent)) {
            $previous = Join-Path $backup (Split-Path $file -Leaf)
            if (Test-Path -LiteralPath $previous) { Copy-Item -LiteralPath $previous -Destination $file -Force }
            elseif ($file -eq $agent -and (Test-Path -LiteralPath $file)) { Remove-Item -LiteralPath $file -Force }
        }
        & $pm2 restart shopee-auto-print | Out-Null
        & $pm2 save | Out-Null
    }
    throw
}
