# Versao Atual

```text
version: v1.1.54-pdv-serial-bling-name-lock
date: 2026-06-17
status: published
release_vps: /var/www/mdv-site/releases/20260617-130333-v1154-pdv-serial-bling-name-lock
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- Produtos serializados novos cadastrados pelo formulario passam a gerar unidade em `units`, em vez de deixar Serial/IMEI apenas em `products.specs`.
- A busca do PDV continua encontrando unidades reais e agora tambem cobre produtos legados com Serial/IMEI salvo em `specs`, evitando sumico de item disponivel.
- O endpoint VPS `/pdv/product-search` tambem busca por `specs.serial`, `specs.serial_number`, `specs.imei1` e `specs.imei2`.
- O painel do modelo mostra o numero do pedido e o nome do cliente na lista de vendidos.
- Clicar na venda pelo painel do modelo abre direto o detalhe da venda, em vez de parar na lista de vendas.
- Produtos criados ou editados no sistema preservam o nome local contra atualizacao automatica do Bling.
- Produtos importados do Bling continuam com nome dinamico pelo Bling.
- Ao informar SKU do Bling no cadastro, o formulario tenta pre-selecionar modelo local existente e preencher o nome somente quando o campo esta vazio.

## Como Recuperar

Use a tag/versao `v1.1.54-pdv-serial-bling-name-lock` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-17-v1.1.54-pdv-serial-bling-name-lock.md
```

## Publicacao

- Release VPS publicada: `/var/www/mdv-site/releases/20260617-130333-v1154-pdv-serial-bling-name-lock`.
- Esta versao altera frontend/admin, servicos de produto/Bling e endpoints VPS; site e API VPS publicados.
