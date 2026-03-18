# check-vps-schema.ps1
# Consulta o schema do MySQL VPS em tempo real
# Uso:
#   .\check-vps-schema.ps1                     -> lista todas as tabelas e colunas
#   .\check-vps-schema.ps1 -Table banners      -> mostra apenas a tabela especificada
#   .\check-vps-schema.ps1 -Field store_label  -> busca campo em todas as tabelas

param(
    [string]$Table = "",
    [string]$Field = ""
)

$VPS_URL = "https://api.xiaomipetrolina.com.br"
$KEY = $env:VITE_VPS_SYNC_KEY
if (-not $KEY) {
    $envFile = Join-Path $PSScriptRoot ".env.local"
    if (Test-Path $envFile) {
        $KEY = (Get-Content $envFile | Where-Object { $_ -match "^VITE_VPS_SYNC_KEY=" }) -replace "^VITE_VPS_SYNC_KEY=", ""
    }
}
if (-not $KEY) {
    Write-Error "VITE_VPS_SYNC_KEY nao encontrado."
    exit 1
}

$headers = @{ "x-sync-key" = $KEY }

# -- Tabela especifica -------------------------------------------------------
if ($Table) {
    Write-Host "`nSchema de '$Table':`n" -ForegroundColor Cyan
    try {
        $cols = Invoke-RestMethod -Uri "$VPS_URL/schema/table/$Table" -Headers $headers -TimeoutSec 10
        $cols | Format-Table field, type, null, key, default -AutoSize
    } catch {
        Write-Error "Tabela '$Table' nao encontrada ou erro: $_"
    }
    exit 0
}

# -- Todas as tabelas --------------------------------------------------------
Write-Host "`nBuscando schema completo do MySQL VPS..." -ForegroundColor Yellow
$schema = Invoke-RestMethod -Uri "$VPS_URL/schema/tables" -Headers $headers -TimeoutSec 30
$tableNames = $schema | Get-Member -MemberType NoteProperty | Select-Object -ExpandProperty Name

# -- Busca por campo ---------------------------------------------------------
if ($Field) {
    Write-Host "`nBuscando campo '$Field' em todas as tabelas:`n" -ForegroundColor Cyan
    foreach ($t in $tableNames) {
        $cols = $schema.$t
        $match = $cols | Where-Object { $_.field -like "*$Field*" }
        if ($match) {
            Write-Host "  FOUND: $t" -ForegroundColor Green
            $match | ForEach-Object { Write-Host "    -> $($_.field) [$($_.type)]" -ForegroundColor Gray }
        }
    }
    exit 0
}

# -- Listagem completa -------------------------------------------------------
Write-Host "`n$($tableNames.Count) tabelas encontradas:`n" -ForegroundColor Green
foreach ($t in $tableNames) {
    $cols = $schema.$t
    $colList = ($cols | ForEach-Object { $_.field }) -join ", "
    Write-Host "  TABLE: $t ($($cols.Count) cols)" -ForegroundColor Cyan
    Write-Host "    $colList" -ForegroundColor Gray
    Write-Host ""
}
