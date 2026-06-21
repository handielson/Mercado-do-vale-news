# Versao Atual

```text
version: v1.1.77-whatsapp-smartphones-category
date: 2026-06-21
status: published
release_vps: /var/www/mdv-site/releases/20260621-085549-v1177-whatsapp-smartphones-category
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- O bot do WhatsApp passa a tratar celulares e smartphones como a mesma categoria operacional.
- Quando o cliente pedir celulares, celular, smartphones ou smartphone, a busca consulta e envia sempre a categoria Smartphones.
- A lista completa de celulares/smartphones passa a limitar por modelos distintos depois de buscar mais linhas de estoque, evitando responder apenas poucas variacoes do mesmo modelo.
- O mesmo tratamento foi aplicado aos caminhos de template, busca por categoria, escolha numerada de categoria e pedido com or?amento por categoria.

## Como Recuperar

Use a tag/versao `v1.1.77-whatsapp-smartphones-category` ou o arquivo:

`docs/versoes/2026-06-21-v1.1.77-whatsapp-smartphones-category.md`
