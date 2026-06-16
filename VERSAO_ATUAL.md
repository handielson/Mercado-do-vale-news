# Versao Atual

```text
version: v1.1.34-telegram-sales-auto
date: 2026-06-16
status: published
release_vps: /var/www/mdv-site/releases/20260616-060039-v1134-telegram-sales-auto
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- Webhook do Mercado Pago passa a disparar notificacao Telegram quando um pedido online e marcado como pago.
- Vendas PDV passam a disparar notificacao Telegram depois que os itens da venda sao persistidos na VPS.
- Notificacoes usam os templates configurados do bot (`online_order_paid_template` e `sale_template`).
- Foi adicionada trava de deduplicacao no MySQL para evitar mensagem repetida do mesmo pedido/venda em retries.
- O envio faz fallback sem Markdown quando o Telegram rejeita a formatacao do template.

## Como Recuperar

Use a tag/versao `v1.1.34-telegram-sales-auto` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-16-v1.1.34-telegram-sales-auto.md
```

## Publicacao

- Release VPS planejada/publicada: `/var/www/mdv-site/releases/20260616-060039-v1134-telegram-sales-auto`.
- Esta versao altera API/webhooks e o arquivo publico de versao; publicar site e reiniciar API.
