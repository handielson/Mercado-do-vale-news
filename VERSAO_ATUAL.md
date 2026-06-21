# Versao Atual

```text
version: v1.1.74-delivery-shopee-pdp
date: 2026-06-20
status: published
release_vps: /var/www/mdv-site/releases/20260620-235511-v1174-delivery-shopee-pdp
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- Cria o extrato do entregador com entradas por entrega, saidas por pagamento/abatimento, data, hora, pedido, cliente, forma de pagamento e saldo acumulado.
- Salva `payment_method` nos pagamentos do entregador e migra a coluna em tabelas existentes.
- Oculta campos internos normalizados na pagina publica do produto e mostra itens que acompanham/brindes em lista com `1 item` na mesma linha.
- Cria a tabela `shopee_templates` na migracao da VPS para corrigir o erro ao entrar nos produtos para exportar para a Shopee.

## Como Recuperar

Use a tag/versao `v1.1.74-delivery-shopee-pdp` ou o arquivo:

`docs/versoes/2026-06-20-v1.1.74-delivery-shopee-pdp.md`
