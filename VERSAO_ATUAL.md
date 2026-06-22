# Versao Atual

```text
version: v1.1.86-shopee-model-defaults
date: 2026-06-22
status: published
release_vps: /var/www/mdv-site/releases/20260622-003000-v1186-shopee-model-defaults
branch: codex/publish-delivery-ops-20260614
summary: Defaults universais da Shopee tambem preenchem automaticamente os atributos da aba JSON/IA em Modelos.
```

## O que entrou no v1.1.86

- A tela de Modelos agora carrega os templates Shopee antes de montar os atributos da categoria.
- Defaults universais por ID, como `100121 = 3 meses` e `100370 = Garantia do fornecedor`, tambem preenchem os campos da aba JSON / IA.
- Placeholders dos defaults universais continuam sendo renderizados, incluindo `{package_dimensions}` quando houver dimensoes no modelo.
- Valores dos defaults sao alinhados com as opcoes retornadas pela Shopee para que selects como garantia, tipo de garantia e condicao aparecam selecionados.
- Protecao de regressao atualizada para impedir que o modal de modelos deixe de carregar `universal_defaults`.

## Validacoes

- `node tmp-tests\shopee-universal-attribute-defaults-static.test.mjs`
- `node tmp-tests\model-shopee-attributes-json-section-static.test.mjs`
- `npm.cmd run build`
