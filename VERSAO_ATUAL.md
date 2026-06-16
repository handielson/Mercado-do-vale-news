# Versao Atual

```text
version: v1.1.35-telegram-settings-table
date: 2026-06-16
status: published
release_vps: /var/www/mdv-site/releases/20260616-063659-v1135-telegram-settings-table
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- A API da VPS passa a criar automaticamente a tabela `telegram_settings`, exigida pelo bot Telegram.
- A tabela nasce com templates padrao para venda PDV e pedido online pago, sem token/chat preenchidos.
- A guarda de Telegram agora impede regressao onde a tabela de configuracao existe no codigo do painel, mas falta no MySQL.
- Corrige a escala de itens antigos no historico do cliente quando valores em centavos aparecem no MySQL com sufixo `.00`.
- Mantem os totais de venda em centavos, evitando que itens como `19710.00` aparecam como `R$ 19.710,00`.

## Como Recuperar

Use a tag/versao `v1.1.35-telegram-settings-table` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-16-v1.1.35-telegram-settings-table.md
```

## Publicacao

- Release VPS planejada/publicada: `/var/www/mdv-site/releases/20260616-063659-v1135-telegram-settings-table`.
- Esta versao altera API/migracoes, servico de vendas e arquivo publico de versao; publicar site e reiniciar API.
