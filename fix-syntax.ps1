$content = Get-Content 'pages\LegacyMigration.tsx' -Raw
$content = $content -replace '            \</div\>\r\n        \)\r\n    \}\r\n    \</div \>\r\n    \)\r\n\}$', '            </div>`r`n        )}`r`n    )`r`n}'
$content | Set-Content 'pages\LegacyMigration.tsx' -NoNewline
