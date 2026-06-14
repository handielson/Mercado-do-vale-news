# Versao Atual

```text
version: v1.1.2-visible-version
date: 2026-06-14
status: published
release_vps: /var/www/mdv-site/releases/20260614-192449-v112-visible-version
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- Lista para cadastro em massa com botao explicito `Adicionar a Lista`.
- Vinculo Bling por SKU preservando EAN, preco de compra e preco de varejo.
- Novo preenchimento automatico pelo Bling:
  - primeiro tenta `variacao.nome`;
  - depois tenta o `nome` do produto;
  - por ultimo tenta `nomePai`;
  - so seleciona cores que existem no cadastro do sistema.
- Campos preenchidos quando identificados:
  - `specs.color`;
  - `specs.ram`;
  - `specs.storage`.
- Registro publico de versao em `/VERSION.json`.
- Versao visivel no rodape da barra lateral do admin.

## Como Recuperar

Use a tag/versao `v1.1.2-visible-version` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-14-v1.1.2-visible-version.md
```
