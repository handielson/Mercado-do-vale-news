# Versao Atual

```text
version: v1.1.57-model-panel-serial-brand
date: 2026-06-17
status: published
release_vps: /var/www/mdv-site/releases/20260617-175659-v1157-model-panel-serial-brand
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- O painel do modelo passa a contar produtos com IMEI/serial em `specs` como unidade disponivel quando nao existe linha em `units`, alinhando com o PDV.
- A tabela `Unidades vendidas` agora mostra `Pedido` e `Cliente` em colunas separadas, buscando o nome do cliente por `customer_id`.
- Vendas PDV sem numero proprio aparecem com rotulo curto `PDV-XXXXXXXX`, em vez do UUID inteiro.
- O nome publico preserva sufixos de rede como `5G`, mantendo `Redmi Note 15 Pro 5G` completo.
- A modal de novo modelo carrega marcas sem cache, para marcas recem-criadas como `Oukitel` aparecerem imediatamente.
- Mantem as correcoes de custo/lucro do painel do modelo e normalizacao de valores legados de venda.

## Como Recuperar

Use a tag/versao `v1.1.57-model-panel-serial-brand` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-17-v1.1.57-model-panel-serial-brand.md
```

## Publicacao

- Release VPS publicada: `/var/www/mdv-site/releases/20260617-175659-v1157-model-panel-serial-brand`.
- Esta versao altera painel admin de modelos, pagina publica de produto e servicos frontend; site VPS publicado.
