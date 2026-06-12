param(
  [string]$HostName = "76.13.232.162",
  [string]$User = "root",
  [string]$RemoteScript = "/tmp/mdv-vps-abuse-audit.sh",
  [string]$LocalOutDir = ".\vps-abuse-audit-output"
)

$ErrorActionPreference = "Stop"

$scriptPath = Join-Path $PSScriptRoot "vps-abuse-audit.sh"
if (-not (Test-Path $scriptPath)) {
  throw "Script nao encontrado: $scriptPath"
}

New-Item -ItemType Directory -Force -Path $LocalOutDir | Out-Null

$target = "${User}@${HostName}"
Write-Host "Enviando auditoria para $target:$RemoteScript"
scp $scriptPath "${target}:$RemoteScript"

Write-Host "Executando auditoria somente leitura no VPS..."
$remoteOutput = ssh $target "chmod +x '$RemoteScript' && '$RemoteScript'"
$remoteOutput | Tee-Object -FilePath (Join-Path $LocalOutDir "remote-output.txt")

$archiveLine = $remoteOutput | Where-Object { $_ -like "Archive:*" } | Select-Object -Last 1
if (-not $archiveLine) {
  throw "Nao encontrei a linha Archive no retorno remoto. Veja $LocalOutDir\remote-output.txt"
}

$archivePath = ($archiveLine -replace "^Archive:\s*", "").Trim()
$hashPath = "$archivePath.sha256"

Write-Host "Baixando pacote de evidencias: $archivePath"
scp "${target}:$archivePath" $LocalOutDir

Write-Host "Baixando hash: $hashPath"
scp "${target}:$hashPath" $LocalOutDir

Write-Host "Auditoria concluida. Arquivos salvos em: $LocalOutDir"
