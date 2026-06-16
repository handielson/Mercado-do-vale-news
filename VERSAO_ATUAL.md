# Versao Atual

```text
version: v1.1.43-pdv-unit-price-input
date: 2026-06-16
status: published
release_vps: /var/www/mdv-site/releases/20260616-110247-v1143-pdv-unit-price-input
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- Corrige a digitacao do campo `Unidade` no carrinho do PDV.
- Mantem o texto digitado localmente enquanto o campo esta em foco, evitando que a formatacao `R$ ...` trave a entrada depois do primeiro digito.
- Ao sair do campo, volta a exibir o valor em formato monetario brasileiro.
- Atualiza a guarda de regressao do input monetario do carrinho.
- Atualiza a guarda de normalizacao de preco do PDV para o helper atual de preco por cliente.

## Como Recuperar

Use a tag/versao `v1.1.43-pdv-unit-price-input` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-16-v1.1.43-pdv-unit-price-input.md
```

## Publicacao

- Release VPS planejada/publicada: `/var/www/mdv-site/releases/20260616-110247-v1143-pdv-unit-price-input`.
- Esta versao altera o frontend/admin de vendas/PDV e o arquivo publico de versao; publicar site.
