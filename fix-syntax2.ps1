$content = Get-Content 'pages\LegacyMigration.tsx' -Raw
$content = $content -replace '\{/\* Modal de Detalhes do Cliente \*/ \}\r\n    \{\r\n        selectedCustomer', '{/* Modal de Detalhes do Cliente */}`r`n        {selectedCustomer'
$content | Set-Content 'pages\LegacyMigration.tsx' -NoNewline
