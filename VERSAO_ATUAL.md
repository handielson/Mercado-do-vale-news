# Versao Atual

```text
version: v1.1.83-shopee-category-name-search
date: 2026-06-21
status: published
release_vps: /var/www/mdv-site/releases/20260621-143855-v1183-shopee-category-name-search
branch: codex/publish-delivery-ops-20260614
summary: Categoria Shopee no cadastro de modelos agora pode ser buscada pelo nome abaixo da Categoria Padrao, salvando o ID internamente e carregando atributos automaticamente.
```

## O que entrou no v1.1.83

- Campo "Categoria Shopee" abaixo de "Categoria Padrao" na aba JSON / IA do cadastro de modelos.
- Busca de categoria Shopee pelo nome usando a lista oficial retornada por `/api/shopee-catalog?action=categories`.
- Selecao da categoria salva o ID Shopee internamente e dispara o carregamento dos atributos da categoria.
- Aba Shopee mantida, mas o fluxo principal tambem passa a usar busca por nome em vez de digitar ID manualmente.
- Protecao contra regressao em `tmp-tests/model-modal-shopee-category-name-search-static.test.mjs`.

## O que entrou no v1.1.82 (incluido neste deploy)

- Novo helper `pages/admin/settings/shopeeAttributeResolver.js` com logica de normalizacao de atributos + sugestoes de valores, reusavel por outros componentes.
- `ModelModal.tsx`: useEffect reativo a `shopeeCategoryId` que busca atributos via `/api/shopee-catalog?action=attributes&category_id=<id>`.
- Pre-preenchimento automatico do JSON de "Atributos Padrao" com sugestoes (marca local, modelo do nome, defaults do template de capa de celular).
- Atributos obrigatorios sem sugestao entram como string vazia para o operador preencher.
- UI: spinner de carregamento, mensagem de erro, botao "Recarregar", badges coloridos por atributo (obrigatorio/preenchido/vazio).
- Protecao contra regressao com checks em `tmp-tests/shopee-model-modal-auto-attributes-static.test.mjs`.

## O que entrou no v1.1.81 (incluido neste deploy)

- Handler `search_synced_products` no servidor para o botao "Buscar" da aba Shopee do ModelModal.
- Antes a acao caia no default "Acao desconhecida" e a busca de categoria similar nao retornava nada.
