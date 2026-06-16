# Versao Atual

```text
version: v1.1.39-pdv-finalization-log-vps
date: 2026-06-16
status: published
release_vps: /var/www/mdv-site/releases/20260616-094333-v1139-pdv-finalization-log-vps
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- Remove a gravacao do historico local do log de finalizacao do PDV em `localStorage`.
- Mantem o log disponivel na tela para copiar ou baixar em TXT.
- Mantem o envio do log no payload da venda, em `finalization_log`, para registro na VPS.
- Ajusta o nome do TXT baixado para usar o numero da venda quando existir.
- Atualiza a guarda de regressao para impedir a volta da chave antiga `pdv_sale_finalization_log_*`.

## Como Recuperar

Use a tag/versao `v1.1.39-pdv-finalization-log-vps` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-16-v1.1.39-pdv-finalization-log-vps.md
```

## Publicacao

- Release VPS planejada/publicada: `/var/www/mdv-site/releases/20260616-094333-v1139-pdv-finalization-log-vps`.
- Esta versao altera o frontend/admin do PDV e o arquivo publico de versao; publicar site.
