$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

function Invoke-GitText([string[]] $Arguments) {
  $value = & git -C $root @Arguments 2>$null
  if ($LASTEXITCODE -ne 0) { return $null }
  return ($value -join "`n").Trim()
}

$tracked = Invoke-GitText @('ls-files')
$sensitivePattern = '(?i)(^|/)(\.env(?:\.[^/]*)?|[^/]*(?:secret|credential|token|private.?key)[^/]*|[^/]+\.(?:pem|key|p12|pfx))$'
$sensitivePaths = @(
  @($tracked -split "`n") | Where-Object { $_ -match $sensitivePattern }
  Get-ChildItem -LiteralPath $root -Force -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match $sensitivePattern } |
    ForEach-Object { $_.Name }
) | Sort-Object -Unique

$status = Invoke-GitText @('status', '--short', '--branch')
$snapshot = [ordered]@{
  root = $root
  branch = Invoke-GitText @('branch', '--show-current')
  revision = Invoke-GitText @('rev-parse', 'HEAD')
  status = @($status -split "`n" | Where-Object { $_ })
  sensitivePathsOnly = $sensitivePaths
  note = 'Nenhum conteudo de arquivo sensivel e lido ou exibido.'
}
$snapshot | ConvertTo-Json -Depth 4
