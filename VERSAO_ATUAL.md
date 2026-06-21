# Versao Atual

```text
version: v1.1.78-whatsapp-ai-first-catalog
date: 2026-06-21
status: published
release_vps: /var/www/mdv-site/releases/20260621-091449-v1178-whatsapp-ai-first-catalog
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- O ChatGPT passa a conduzir primeiro os pedidos de catalogo no webhook/laboratorio interno.
- O bot nao responde mais pedido generico de celulares por um atalho fixo antes da IA.
- Para celular/celulares/smartphone/smartphones, a IA e instruida a chamar `catalog_search` com query `smartphones`.
- A ferramenta de catalogo entrega contexto completo de `Smartphones` para pedidos genericos de celulares, permitindo a IA montar a resposta final com a lista correta.
- `vps_server.cjs` foi sincronizado com `vps_server.js` para a VPS nao rodar logica antiga.

## Como Recuperar

Use a tag/versao `v1.1.78-whatsapp-ai-first-catalog` ou o arquivo:

`docs/versoes/2026-06-21-v1.1.78-whatsapp-ai-first-catalog.md`
