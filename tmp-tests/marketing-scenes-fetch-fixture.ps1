$ErrorActionPreference = 'Stop'
# Public, read-only assets for local compositor QA. No authentication or production mutations.
$fixtureDir = Join-Path $PSScriptRoot 'marketing-scenes-fixture'
New-Item -ItemType Directory -Path $fixtureDir -Force | Out-Null
$response = Invoke-RestMethod -Uri 'https://api.xiaomipetrolina.com.br/products?search=ON-BL700A&limit=3' -TimeoutSec 20
$product = @($response) | Where-Object { $_.id -eq '7c08e6ed-9735-4add-b9e0-c01783d00043' } | Select-Object -First 1
if (-not $product) { throw 'Balança oficial não encontrada.' }
$product | Select-Object id,name,brand,model,category_id,images,price_retail,specs,description | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $fixtureDir 'product.json') -Encoding utf8
Invoke-WebRequest -Uri $product.images[0] -OutFile (Join-Path $fixtureDir 'product.webp') -TimeoutSec 30
Invoke-WebRequest -Uri 'https://images.pexels.com/photos/8175345/pexels-photo-8175345.jpeg?w=1440&auto=compress' -OutFile (Join-Path $fixtureDir 'kitchen.jpg') -TimeoutSec 30
@{ source='Public catalog + manually selected Pexels photo, not an authenticated API search'; productId=$product.id; photoPage='https://www.pexels.com/photo/kitchen-accessories-and-ingredients-on-counter-8175345/'; photographer='Ron Lach'; photographerPage='https://www.pexels.com/@ron-lach/'; fetchedAt=(Get-Date).ToUniversalTime().ToString('o') } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $fixtureDir 'sources.json') -Encoding utf8
Write-Output 'Public fixture assets saved locally.'
