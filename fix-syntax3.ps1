$content = Get-Content 'pages\LegacyMigration.tsx' -Raw
$content = $content.Replace('{/* Modal de Detalhes do Cliente */}`r`n        {selectedCustomer', "{/* Modal de Detalhes do Cliente */}`r`n        {selectedCustomer")
$content | Set-Content 'pages\LegacyMigration.tsx' -NoNewline
