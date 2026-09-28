param()

$repoRoot = Split-Path -Parent $PSScriptRoot
$url = 'http://127.0.0.1:3000/loja-3d'

try {
  Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2 | Out-Null
} catch {
  Start-Process -FilePath 'npm.cmd' -ArgumentList 'run', 'dev', '--', '--host', '127.0.0.1', '--port', '3000' -WorkingDirectory $repoRoot -WindowStyle Minimized

  $deadline = (Get-Date).AddSeconds(30)
  do {
    Start-Sleep -Milliseconds 500
    try {
      Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2 | Out-Null
      break
    } catch {
      if ((Get-Date) -ge $deadline) {
        throw 'A Loja 3D local não iniciou em 30 segundos.'
      }
    }
  } while ($true)
}

Start-Process $url
