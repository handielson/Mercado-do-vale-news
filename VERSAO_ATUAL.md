# v1.2.474-fiscal-datas

Data: 25/09/2026
Status: ready
Branch: main
Tag: v1.2.474-fiscal-datas
Release VPS: /var/www/mdv-site/releases/20260925-024500-v12474-fiscal-datas

## Alterações

- As notas são ordenadas pela data real de emissão, da mais recente para a mais antiga.
- O aviso de cobertura mostra a primeira e a última data cadastrada, independentemente da ordem dos registros.
- O histórico do Bling de 01/10/2025 a 24/09/2026 foi conferido em lotes e importado na base fiscal da empresa principal.

## Validação

- `npm.cmd run test:accountant-portal`
- `npm.cmd run build`
- `git diff --check`
