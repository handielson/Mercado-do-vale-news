# Backup Diário Automático - Mercado do Vale
# Executa commit e tag com data atual

$date = Get-Date -Format "yyyy-MM-dd"
$time = Get-Date -Format "HH:mm"
$tagName = "backup-$date"
$commitMessage = "🔄 Backup Diário - $date às $time"

Write-Host "🔄 Iniciando backup diário..." -ForegroundColor Cyan
Write-Host ""

# Verifica se há mudanças
$status = git status --porcelain
if ($status) {
    Write-Host "📝 Mudanças detectadas. Criando commit..." -ForegroundColor Yellow
    
    # Add all changes
    git add .
    
    # Commit
    git commit -m $commitMessage
    
    # Create tag
    git tag -a $tagName -m "Backup automático do dia $date"
    
    Write-Host ""
    Write-Host "✅ Backup criado com sucesso!" -ForegroundColor Green
    Write-Host "📌 Tag: $tagName" -ForegroundColor Green
    Write-Host "💾 Commit: $commitMessage" -ForegroundColor Green
} else {
    Write-Host "ℹ️  Nenhuma mudança detectada. Backup não necessário." -ForegroundColor Gray
}

Write-Host ""
Write-Host "📊 Últimos 5 backups:" -ForegroundColor Cyan
git tag -l "backup-*" | Sort-Object -Descending | Select-Object -First 5

Write-Host ""
Write-Host "✅ Processo concluído!" -ForegroundColor Green
