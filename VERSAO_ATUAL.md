# Versao Atual

```text
version: v1.1.82-shopee-model-auto-attributes
date: 2026-06-21
status: pending
release_vps: pendente
branch: codex/publish-delivery-ops-20260614
summary: Ao definir uma categoria Shopee no cadastro de modelos (aba Shopee do ModelModal), busca automaticamente os atributos da categoria e preenche sugestoes (marca local, modelo do nome, defaults de template). Tambem inclui o fix v1.1.81 (search_synced_products) que estava pendente de publish.
```

## O que entrou no v1.1.81 (incluido neste deploy)

- Handler `search_synced_products` no servidor para o botao "Buscar" da aba Shopee do ModelModal.
- Antes a acao caia no default "Acao desconhecida" e a busca de categoria similar nao retornava nada.

## O que entrou no v1.1.82

- Novo helper `pages/admin/settings/shopeeAttributeResolver.js` com logica de normalizacao de atributos + sugestoes de valores, reusavel por outros componentes.
- `ModelModal.tsx`: useEffect reativo a `shopeeCategoryId` que busca atributos via `/api/shopee-catalog?action=attributes&category_id=<id>`.
- Pre-preenchimento automatico do JSON de "Atributos Padrao" com sugestoes (marca local, modelo do nome, defaults do template de capa de celular).
- Atributos obrigatorios sem sugestao entram como string vazia para o operador preencher.
- UI: spinner de carregamento, mensagem de erro, botao "Recarregar", badges coloridos por atributo (obrigatorio/preenchido/vazio).
- Protecao contra regressao com 33 checks em `tmp-tests/shopee-model-modal-auto-attributes-static.test.mjs`.
- `ShopeePage.tsx` mantido intacto (sem refatoracao) para minimizar risco de regressao.
