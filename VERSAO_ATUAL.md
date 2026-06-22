# Versao Atual

```text
version: v1.1.87-model-ai-bling-search
date: 2026-06-22
status: published
release_vps: /var/www/mdv-site/releases/20260622-011500-v1187-model-ai-bling-search
branch: codex/publish-delivery-ops-20260614
summary: JSON/IA de Modelos usa descricao do Bling como contexto prioritario, amplia busca externa e separa descricao comercial de atributos.
```

## O que entrou no v1.1.87

- O gerador JSON/IA da tela de Modelos busca produtos vinculados ao modelo e envia a descricao completa do Bling/local como contexto interno prioritario.
- A rota `/models/generate-json` limpa esse contexto e usa a internet apenas para complementar ou confirmar lacunas.
- Produtos fora de smartphone nao ficam limitados aos sites confiaveis de smartphone; a busca ampla consulta varias fontes independentes.
- A geracao ganhou mais tempo e mais tokens para retornar descricoes completas.
- A descricao comercial do modelo remove frases que pertencem a atributos/politicas, como garantia, condicao, SKU, estoque, preco ou "verificar vendedor".
- Defaults Shopee dinamicos como `{sku}` usam o primeiro SKU real de produto vinculado ao modelo quando existir.

## Validacoes

- `node tmp-tests\model-ai-generate-json-static.test.mjs`
- `node tmp-tests\model-json-import.test.mjs`
- `node tmp-tests\shopee-universal-attribute-defaults-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `npm.cmd run build`
